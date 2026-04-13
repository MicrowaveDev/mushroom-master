import 'dotenv/config';
import path from 'path';
import express from 'express';
import OpenAI from 'openai';
import {
  authenticateRequest,
  createTelegramAuthCode,
  loginWithDevSession,
  loginWithTelegram,
  requireAuth,
  verifyTelegramAuthCode
} from './auth.js';
import { createMentionReply, createBrowserFallbackPayload, handleBotStartParam } from './bot-gateway.js';
import { getDb, resetDb, query as dbQuery } from './db.js';
import { CHALLENGE_IDLE_TIMEOUT_MS, ROUND_INCOME, PORTRAIT_VARIANTS, STARTER_PRESET_VARIANTS } from './game-data.js';
import { computeLevel } from './lib/utils.js';
import {
  acceptFriendChallenge,
  addFriendByCode,
  declineFriendChallenge,
  getBattle,
  getBattleHistory,
  getBootstrap,
  getInventoryReviewSamples,
  getFriendChallenge,
  getFriends,
  getLeaderboard,
  getPlayerState,
  applyRunLoadoutPlacements,
  saveLocalTestRun,
  selectActiveMushroom,
  startGameRun,
  getActiveGameRun,
  abandonGameRun,
  getGameRun,
  resolveRound,
  refreshRunShop,
  forceRunShopForTest,
  sellRunItem,
  buyRunShopItem,
  createRunChallenge,
  getGameRunHistory,
  updateSettings,
  switchPortrait,
  switchPreset
} from './services/game-service.js';
import * as readyManager from './services/ready-manager.js';
import * as sseManager from './services/sse-manager.js';
import { log, requestLogger } from './lib/obs.js';
import { idempotency } from './lib/idempotency.js';
import { rateLimit, clearRateLimitBuckets } from './lib/rate-limit.js';
import { getWikiEntry, getWikiHome } from './wiki.js';

const repoRoot = '/Users/microwavedev/workspace/mushroom-master';
const webDist = path.join(repoRoot, 'web/dist');

function isLocalAiLabEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'mushroom_game_bot';
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function requireRunMembership(req, _res, next) {
  try {
    const gameRunId = req.params.id;
    const playerId = req.user.id;
    const result = await dbQuery(
      `SELECT id FROM game_run_players WHERE game_run_id = $1 AND player_id = $2`,
      [gameRunId, playerId]
    );
    if (!result.rowCount) {
      return next(new Error('You are not part of this game run'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function createApp() {
  await getDb();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(requestLogger());
  app.use(authenticateRequest);

  const runMutationGuards = [rateLimit(), idempotency()];

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });

  app.get('/api/app-config', (_req, res) => {
    res.json({
      success: true,
        data: {
        localAiLabEnabled: isLocalAiLabEnabled(),
        localDevAuthEnabled: process.env.NODE_ENV !== 'production'
      }
    });
  });

  app.post(
    '/api/auth/telegram',
    asyncRoute(async (req, res) => {
      const result = await loginWithTelegram(req.body.initData, process.env.TELEGRAM_BOT_TOKEN || '');
      res.json({
        success: true,
        data: {
          sessionKey: result.session.sessionKey,
          user: {
            id: result.player.id,
            telegramId: result.player.telegram_id,
            telegramUsername: result.player.telegram_username,
            name: result.player.name,
            lang: result.player.lang
          }
        }
      });
    })
  );

  app.post(
    '/api/auth/telegram/code',
    asyncRoute(async (_req, res) => {
      const payload = await createBrowserFallbackPayload(botUsername());
      res.json({ success: true, data: payload });
    })
  );

  app.post(
    '/api/auth/telegram/verify-code',
    asyncRoute(async (req, res) => {
      const result = await verifyTelegramAuthCode(req.body.privateCode);
      if (!result.success) {
        res.status(result.needsBotAuth ? 200 : 400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          sessionKey: result.session.sessionKey,
          user: {
            id: result.player.id,
            telegramId: result.player.telegram_id,
            telegramUsername: result.player.telegram_username,
            name: result.player.name,
            lang: result.player.lang
          }
        }
      });
    })
  );

  app.get(
    '/api/bootstrap',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getBootstrap(req.user.id);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/profile',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getPlayerState(req.user.id) });
    })
  );

  app.get(
    '/api/characters',
    asyncRoute(async (_req, res) => {
      const { mushrooms } = await import('./game-data.js');
      res.json({ success: true, data: { mushrooms } });
    })
  );

  app.get(
    '/api/artifacts',
    asyncRoute(async (_req, res) => {
      const { artifacts } = await import('./game-data.js');
      res.json({ success: true, data: { artifacts } });
    })
  );

  app.put(
    '/api/active-character',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await selectActiveMushroom(req.user.id, req.body.mushroomId)
      });
    })
  );

  app.put(
    '/api/shop-state',
    requireAuth,
    asyncRoute(async (req, res) => {
      await saveShopState(req.user.id, req.body);
      res.json({ success: true, data: null });
    })
  );

  app.put(
    '/api/artifact-loadout',
    requireAuth,
    ...runMutationGuards,
    asyncRoute(async (req, res) => {
      // Loadout placements are always run-scoped now. The legacy
      // single-battle branch (saveArtifactLoadout against
      // player_artifact_loadouts) was deleted in 2026-04-13.
      const activeRun = await getActiveGameRun(req.user.id);
      if (!activeRun) {
        throw new Error('No active game run');
      }
      await applyRunLoadoutPlacements(req.user.id, activeRun.id, req.body.items || []);
      res.json({ success: true, data: await getActiveGameRun(req.user.id) });
    })
  );

  app.post(
    '/api/settings',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await updateSettings(req.user.id, req.body) });
    })
  );

  app.get(
    '/api/battles/history',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattleHistory(req.user.id) });
    })
  );

  app.get(
    '/api/battles/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattle(req.params.id, req.user.id) });
    })
  );

  app.get(
    '/api/friends',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getFriends(req.user.id) });
    })
  );

  app.post(
    '/api/friends/add-by-code',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await addFriendByCode(req.user.id, req.body.friendCode) });
    })
  );

  app.post(
    '/api/friends/challenges',
    requireAuth,
    asyncRoute(async (req, res) => {
      // Friend challenges always create a multi-round game-run challenge.
      // The legacy single-battle "challenge_type=battle" path was deleted in
      // 2026-04-13. The endpoint name is preserved for frontend compatibility.
      res.json({
        success: true,
        data: await createRunChallenge(req.user.id, req.body.friendPlayerId)
      });
    })
  );

  app.get(
    '/api/friends/challenges/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getFriendChallenge(req.params.id) });
    })
  );

  app.post(
    '/api/friends/challenges/:id/accept',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await acceptFriendChallenge(req.params.id, req.user.id) });
    })
  );

  app.post(
    '/api/friends/challenges/:id/decline',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await declineFriendChallenge(req.params.id, req.user.id) });
    })
  );

  app.get(
    '/api/leaderboard',
    requireAuth,
    asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await getLeaderboard() });
    })
  );

  app.post(
    '/api/game-run/start',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await startGameRun(req.user.id, req.body.mode || 'solo');
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/game-runs/history',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getGameRunHistory(req.user.id);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/game-run/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getGameRun(req.params.id, req.user.id);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/challenge',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await createRunChallenge(req.user.id, req.body.friendPlayerId);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/abandon',
    requireAuth,
    requireRunMembership,
    asyncRoute(async (req, res) => {
      const data = await abandonGameRun(req.user.id, req.params.id);
      if (data.mode === 'challenge') {
        sseManager.sendToOpponent(req.params.id, req.user.id, 'opponent_abandoned', { playerId: req.user.id });
        sseManager.removeRun(req.params.id);
        readyManager.clearRun(req.params.id);
      }
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/ready',
    requireAuth,
    requireRunMembership,
    asyncRoute(async (req, res) => {
      const gameRunId = req.params.id;
      const playerId = req.user.id;

      const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
      if (!runResult.rowCount) throw new Error('Game run not found or already ended');
      const mode = runResult.rows[0].mode;

      if (mode === 'solo') {
        const data = await readyManager.withRunLock(gameRunId, () =>
          resolveRound(playerId, gameRunId)
        );
        return res.json({ success: true, data });
      }

      // Challenge mode
      const data = await readyManager.withRunLock(gameRunId, async () => {
        readyManager.setReady(gameRunId, playerId);
        sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: true });

        const check = readyManager.areBothReady(gameRunId);
        if (!check.ready) {
          return { waiting: true };
        }

        readyManager.clearRound(gameRunId);
        const result = await resolveRound(playerId, gameRunId);

        for (const pid of Object.keys(result.playerResults)) {
          sseManager.sendToPlayer(gameRunId, pid, 'round_result', result.playerResults[pid]);
        }

        if (result.runEnded) {
          sseManager.broadcast(gameRunId, 'run_ended', { endReason: result.endReason });
          sseManager.removeRun(gameRunId);
          readyManager.clearRun(gameRunId);
        }

        return result.playerResults[playerId] || result;
      });

      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/unready',
    requireAuth,
    requireRunMembership,
    asyncRoute(async (req, res) => {
      const gameRunId = req.params.id;
      const playerId = req.user.id;

      const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
      if (!runResult.rowCount) throw new Error('Game run not found');
      if (runResult.rows[0].mode === 'solo') throw new Error('Cannot unready in solo mode');

      // Use the same lock as ready to prevent TOCTOU with concurrent ready calls
      const data = await readyManager.withRunLock(gameRunId, async () => {
        readyManager.setUnready(gameRunId, playerId);
        sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: false });
        return { ready: false };
      });

      res.json({ success: true, data });
    })
  );

  app.get('/api/game-run/:id/events', requireAuth, requireRunMembership, (req, res) => {
    const gameRunId = req.params.id;
    const playerId = req.user.id;
    sseManager.addConnection(gameRunId, playerId, res);
    readyManager.touchActivity(gameRunId);
    req.on('close', () => {
      sseManager.removeConnection(gameRunId, playerId);
    });
  });

  // Challenge timeout sweep — runs on every SSE heartbeat tick (~30 s).
  // Detects challenge runs where no player has signalled ready/unready for
  // CHALLENGE_IDLE_TIMEOUT_MS and auto-abandons them so neither player is stuck.
  sseManager.onHeartbeat(async () => {
    const idleRunIds = readyManager.getIdleRunIds(CHALLENGE_IDLE_TIMEOUT_MS);
    for (const gameRunId of idleRunIds) {
      try {
        // Verify the run is still an active challenge before abandoning
        const runResult = await dbQuery(
          `SELECT mode FROM game_runs WHERE id = $1 AND status = 'active'`,
          [gameRunId]
        );
        if (!runResult.rowCount || runResult.rows[0].mode !== 'challenge') {
          readyManager.clearRun(gameRunId);
          continue;
        }

        // Pick the first registered player to be the "abandoner"
        const grpResult = await dbQuery(
          `SELECT player_id FROM game_run_players WHERE game_run_id = $1 AND is_active = 1 LIMIT 1`,
          [gameRunId]
        );
        if (!grpResult.rowCount) {
          readyManager.clearRun(gameRunId);
          continue;
        }

        const abandonerId = grpResult.rows[0].player_id;
        await abandonGameRun(abandonerId, gameRunId);
        sseManager.broadcast(gameRunId, 'run_ended', { endReason: 'timeout' });
        sseManager.removeRun(gameRunId);
        readyManager.clearRun(gameRunId);
        log.info(`Challenge run ${gameRunId} auto-abandoned after idle timeout`);
      } catch (err) {
        log.error(`Failed to auto-abandon idle challenge run ${gameRunId}: ${err.message}`);
      }
    }
  });

  app.post(
    '/api/game-run/:id/refresh-shop',
    requireAuth,
    requireRunMembership,
    ...runMutationGuards,
    asyncRoute(async (req, res) => {
      const data = await refreshRunShop(req.user.id, req.params.id);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/sell',
    requireAuth,
    requireRunMembership,
    ...runMutationGuards,
    asyncRoute(async (req, res) => {
      const data = await sellRunItem(req.user.id, req.params.id, req.body.artifactId);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/buy',
    requireAuth,
    requireRunMembership,
    ...runMutationGuards,
    asyncRoute(async (req, res) => {
      const data = await buyRunShopItem(req.user.id, req.params.id, req.body.artifactId);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/wiki/home',
    asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await getWikiHome() });
    })
  );

  // Character wiki: gate lore sections by the player's mycelium for that mushroom.
  app.get(
    '/api/wiki/characters/:slug',
    asyncRoute(async (req, res) => {
      let mycelium = 0;
      if (req.user) {
        const row = await dbQuery(
          `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
          [req.user.id, req.params.slug]
        );
        mycelium = row.rowCount ? row.rows[0].mycelium : 0;
      }
      res.json({ success: true, data: await getWikiEntry('characters', req.params.slug, mycelium) });
    })
  );

  for (const section of ['locations', 'factions', 'glossary']) {
    app.get(
      `/api/wiki/${section}/:slug`,
      asyncRoute(async (req, res) => {
        res.json({ success: true, data: await getWikiEntry(section, req.params.slug) });
      })
    );
  }

  // Switch active portrait for a mushroom (unlocked by mycelium threshold).
  app.put(
    '/api/mushroom/:id/portrait',
    requireAuth,
    asyncRoute(async (req, res) => {
      try {
        const data = await switchPortrait(req.user.id, req.params.id, req.body.portraitId);
        res.json({ success: true, data });
      } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
      }
    })
  );

  // Switch active starter preset for a mushroom (unlocked by level).
  app.put(
    '/api/mushroom/:id/preset',
    requireAuth,
    asyncRoute(async (req, res) => {
      try {
        const data = await switchPreset(req.user.id, req.params.id, req.body.presetId);
        res.json({ success: true, data });
      } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
      }
    })
  );

  app.get('/api/bot/discovery', (req, res) => {
    res.json({
      success: true,
      data: createMentionReply({
        botUsername: botUsername(),
        chatType: req.query.chatType || 'group'
      })
    });
  });

  app.post(
    '/api/bot/start',
    asyncRoute(async (req, res) => {
      const data = await handleBotStartParam(req.body.startParam, req.body.telegramUser);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/local-tests/battle-narration',
    requireAuth,
    asyncRoute(async (req, res) => {
      if (!isLocalAiLabEnabled()) {
        res.status(404).json({ success: false, error: 'Local AI Test Lab is disabled in production' });
        return;
      }

      const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
      const results = [];
      const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

      for (const variant of variants) {
        if (!client) {
          results.push({
            variant,
            output: `[mock] ${variant.name}: ${req.body.fixtureNarration || 'No OpenAI key configured.'}`,
            latencyMs: 0,
            usedMock: true
          });
          continue;
        }

        const startedAt = Date.now();
        const response = await client.responses.create({
          model: variant.model || 'gpt-4.1-mini',
          input: `${variant.prompt}\n\nBattle fixture:\n${req.body.fixtureNarration}`
        });
        results.push({
          variant,
          output: response.output_text,
          latencyMs: Date.now() - startedAt,
          usedMock: false
        });
      }

      await saveLocalTestRun({
        fixtureNarration: req.body.fixtureNarration,
        variants,
        results
      });

      res.json({ success: true, data: { results } });
    })
  );

  if (process.env.NODE_ENV !== 'production') {
    // Test-only: deterministically overwrite the current round's shop offer.
    // Playwright tests use this to bypass RNG/pity/refresh polling loops that
    // otherwise race cold Vite compilation. See docs/flaky-tests.md.
    app.post(
      '/api/dev/game-run/:id/force-shop',
      requireAuth,
      requireRunMembership,
      asyncRoute(async (req, res) => {
        const data = await forceRunShopForTest(req.user.id, req.params.id, req.body.artifactIds);
        res.json({ success: true, data });
      })
    );

    app.post(
      '/api/dev/reset',
      asyncRoute(async (_req, res) => {
        await resetDb();
        clearRateLimitBuckets();
        res.json({
          success: true,
          data: { reset: true }
        });
      })
    );

    app.post(
      '/api/dev/session',
      asyncRoute(async (req, res) => {
        const verified = await loginWithDevSession({
          telegramId: req.body.telegramId || 999001,
          username: req.body.username || 'local_player',
          name: req.body.name || 'Local',
          lastName: req.body.lastName || 'Player',
          lang: req.body.lang || 'ru'
        });
        res.json({
          success: true,
          data: {
            sessionKey: verified.session.sessionKey,
            player: verified.player
          }
        });
      })
    );

    app.get(
      '/api/dev/inventory-review',
      requireAuth,
      asyncRoute(async (_req, res) => {
        res.json({
          success: true,
          data: await getInventoryReviewSamples()
        });
      })
    );
  }

  app.use('/data', express.static(path.join(repoRoot, 'data')));
  app.use(express.static(webDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  // Known application errors and their HTTP status codes
  const errorStatusMap = {
    'not found': 404,
    'not part of': 403,
    'only the invited': 403,
    'cannot': 400,
    'already': 409,
    'limit reached': 429,
    'not enough': 400,
    'expired': 410,
    'no longer pending': 409,
    'invalid': 400,
    'unknown': 400
  };

  app.use((error, _req, res, _next) => {
    const msg = (error.message || '').toLowerCase();
    let status = 500;
    for (const [keyword, code] of Object.entries(errorStatusMap)) {
      if (msg.includes(keyword)) {
        status = code;
        break;
      }
    }
    // Only expose message for known application errors; hide internals for 500s
    const isAppError = status !== 500;
    if (!isAppError) {
      log.error({
        kind: 'unhandled',
        requestId: _req.requestId || null,
        playerId: _req.user?.id || null,
        gameRunId: _req.params?.id || null,
        message: error.message,
        stack: error.stack
      });
    }
    res.status(status).json({
      success: false,
      error: isAppError ? error.message : 'Internal server error'
    });
  });

  return app;
}
