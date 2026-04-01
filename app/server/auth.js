import crypto from 'crypto';
import { query, withTransaction } from './db.js';
import { createId, createSessionKey, createShortCode, normalizeLanguage, nowIso } from './lib/utils.js';
import { mushrooms, SESSION_TTL_HOURS } from './game-data.js';

function telegramSecret(botToken) {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) {
    return false;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    return false;
  }

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const calculated = crypto
    .createHmac('sha256', telegramSecret(botToken))
    .update(dataCheckString)
    .digest('hex');

  return calculated === hash;
}

function parseTelegramUser(initData) {
  const params = new URLSearchParams(initData);
  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('Missing Telegram user');
  }
  return JSON.parse(userRaw);
}

async function ensurePlayerMushrooms(client, playerId) {
  for (const mushroom of mushrooms) {
    await client.query(
      `INSERT INTO player_mushrooms (player_id, mushroom_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id, mushroom_id) DO NOTHING`,
      [playerId, mushroom.id]
    );
  }
}

async function ensurePlayerDefaults(client, playerId, defaultLang = 'ru') {
  await client.query(
    `INSERT INTO player_settings (player_id, lang)
     VALUES ($1, $2)
     ON CONFLICT (player_id) DO NOTHING`,
    [playerId, defaultLang]
  );
  await ensurePlayerMushrooms(client, playerId);
}

async function upsertTelegramPlayerWithClient(client, telegramUser) {
  const lookup = await client.query(
    `SELECT * FROM players WHERE telegram_id = $1`,
    [String(telegramUser.id)]
  );

  const name =
    [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
    telegramUser.username ||
    `Telegram User ${telegramUser.id}`;
  const lang = normalizeLanguage(telegramUser.language_code, 'ru');
  const timestamp = nowIso();
  let player;

  if (lookup.rowCount) {
    player = lookup.rows[0];
    await client.query(
      `UPDATE players
       SET telegram_username = $2, name = $3, lang = $4, updated_at = $5
       WHERE id = $1`,
      [player.id, telegramUser.username || null, name, lang, timestamp]
    );
  } else {
    player = {
      id: createId('player'),
      friend_code: await createUniqueFriendCode(client)
    };
    await client.query(
      `INSERT INTO players (id, telegram_id, telegram_username, name, lang, friend_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [player.id, String(telegramUser.id), telegramUser.username || null, name, lang, player.friend_code, timestamp]
    );
  }

  await ensurePlayerDefaults(client, player.id, lang);
  const hydrated = await client.query(`SELECT * FROM players WHERE id = $1`, [player.id]);
  return hydrated.rows[0];
}

async function createSession(client, playerId, provider) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);
  const session = {
    id: createId('session'),
    sessionKey: createSessionKey(),
    playerId,
    provider,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await client.query(
    `INSERT INTO sessions (id, session_key, player_id, provider, created_at, expires_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $5)`,
    [session.id, session.sessionKey, session.playerId, session.provider, session.createdAt, session.expiresAt]
  );

  return session;
}

export async function upsertTelegramPlayer(telegramUser, provider = 'telegram') {
  return withTransaction(async (client) => {
    const player = await upsertTelegramPlayerWithClient(client, telegramUser);
    const session = await createSession(client, player.id, provider);
    return { player, session };
  });
}

export async function loginWithDevSession(payload = {}) {
  return withTransaction(async (client) => {
    const syntheticTelegramUser = {
      id: payload.telegramId || `dev:${payload.username || 'local_player'}`,
      username: payload.username || 'local_player',
      first_name: payload.name || 'Local',
      last_name: payload.lastName || 'Player',
      language_code: payload.lang || 'ru'
    };
    const player = await upsertTelegramPlayerWithClient(client, syntheticTelegramUser);
    const session = await createSession(client, player.id, 'dev_mock');
    return { player, session };
  });
}

export async function loginWithTelegram(initData, botToken) {
  if (!verifyTelegramInitData(initData, botToken)) {
    throw new Error('Invalid Telegram signature');
  }
  const telegramUser = parseTelegramUser(initData);
  return upsertTelegramPlayer(telegramUser, 'telegram');
}

async function createUniqueFriendCode(client) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const found = await client.query('SELECT 1 FROM players WHERE friend_code = $1', [code]);
    if (!found.rowCount) {
      return code;
    }
  }
  throw new Error('Could not allocate unique friend code');
}

export async function createTelegramAuthCode() {
  return withTransaction(async (client) => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const row = {
      id: createId('authcode'),
      privateCode: crypto.randomUUID(),
      publicCode: createShortCode(8),
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    await client.query(
      `INSERT INTO auth_codes (id, provider, private_code, public_code, expires_at, created_at)
       VALUES ($1, 'telegram', $2, $3, $4, $5)`,
      [row.id, row.privateCode, row.publicCode, row.expiresAt, row.createdAt]
    );
    return row;
  });
}

export async function confirmTelegramAuthCode(publicCode, telegramUser) {
  return withTransaction(async (client) => {
    const lookup = await client.query(
      `SELECT * FROM auth_codes WHERE public_code = $1 AND provider = 'telegram'`,
      [publicCode]
    );
    if (!lookup.rowCount) {
      throw new Error('Unknown auth code');
    }
    const authCode = lookup.rows[0];
    if (authCode.used || new Date(authCode.expires_at) < new Date()) {
      throw new Error('Auth code expired');
    }

    const player = await upsertTelegramPlayerWithClient(client, telegramUser);
    await client.query(
      `UPDATE auth_codes
       SET user_id = $2
       WHERE id = $1`,
      [authCode.id, player.id]
    );
    return player;
  });
}

export async function verifyTelegramAuthCode(privateCode) {
  return withTransaction(async (client) => {
    const lookup = await client.query(
      `SELECT * FROM auth_codes WHERE private_code = $1 AND provider = 'telegram'`,
      [privateCode]
    );

    if (!lookup.rowCount) {
      return { success: false, needsBotAuth: false, error: 'Code invalid' };
    }

    const authCode = lookup.rows[0];
    if (authCode.used || new Date(authCode.expires_at) < new Date()) {
      return { success: false, needsBotAuth: false, error: 'Code expired or already used' };
    }
    if (!authCode.user_id) {
      return { success: false, needsBotAuth: true };
    }

    const session = await createSession(client, authCode.user_id, 'telegram_code');
    await client.query('UPDATE auth_codes SET used = 1 WHERE id = $1', [authCode.id]);
    const playerLookup = await client.query('SELECT * FROM players WHERE id = $1', [authCode.user_id]);
    return {
      success: true,
      session,
      player: playerLookup.rows[0]
    };
  });
}

export async function authenticateRequest(req, _res, next) {
  const sessionKey =
    req.header('x-session-key') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  req.authenticated = false;
  if (!sessionKey) {
    return next();
  }

  const sessionResult = await query(
    `SELECT sessions.*, players.telegram_id, players.telegram_username, players.name, players.lang, players.friend_code,
            players.spore, players.rating, players.rated_battle_count, players.wins, players.losses, players.draws, players.id AS player_id
     FROM sessions
     JOIN players ON players.id = sessions.player_id
     WHERE sessions.session_key = $1`,
    [sessionKey]
  );

  if (!sessionResult.rowCount) {
    return next();
  }

  const session = sessionResult.rows[0];
  if (new Date(session.expires_at) < new Date()) {
    return next();
  }

  await query(`UPDATE sessions SET last_seen_at = $2 WHERE id = $1`, [session.id, nowIso()]);
  req.authenticated = true;
  req.session = session;
  req.user = {
    id: session.player_id,
    telegramId: session.telegram_id,
    telegramUsername: session.telegram_username,
    name: session.name,
    lang: session.lang,
    friendCode: session.friend_code,
    spore: session.spore,
    rating: session.rating,
    ratedBattleCount: session.rated_battle_count,
    wins: session.wins,
    losses: session.losses,
    draws: session.draws
  };
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.authenticated) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  return next();
}
