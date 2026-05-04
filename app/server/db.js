import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { QueryTypes, Sequelize } from 'sequelize';
import { repoRoot } from '../shared/repo-root.js';
import { initModels } from './models/index.js';

let state;

function isSelect(sql) {
  return /^\s*(select|pragma|with)\b/i.test(sql);
}

function isInsert(sql) {
  return /^\s*insert\b/i.test(sql);
}

function isUpdate(sql) {
  return /^\s*update\b/i.test(sql);
}

function isDelete(sql) {
  return /^\s*delete\b/i.test(sql);
}

function convertPlaceholders(sql, params = []) {
  const ordered = [];
  const text = sql.replace(/\$(\d+)/g, (_match, indexText) => {
    const index = Number(indexText) - 1;
    ordered.push(params[index]);
    return '?';
  });
  return {
    sql: text,
    replacements: ordered
  };
}

async function resolveSqliteStorage() {
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }

  const relativePath = process.env.SQLITE_STORAGE || 'tmp/telegram-autobattler-dev.sqlite';
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(repoRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

async function createSequelize() {
  if (process.env.DATABASE_URL) {
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false
    });
    sequelize.__storagePath = null;
    return sequelize;
  }

  const storage = await resolveSqliteStorage();
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false
  });
  sequelize.__storagePath = storage;
  return sequelize;
}

async function initSchema(sequelize) {
  if (sequelize.getDialect() === 'sqlite') {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }

  initModels(sequelize);
  await sequelize.sync();
  await ensureColumnExists(sequelize, 'player_settings', 'replay_speed', 'INTEGER NOT NULL DEFAULT 2');
  await ensureColumnExists(sequelize, 'game_run_players', 'mushroom_id', 'TEXT');
  await sequelize.query('DROP INDEX IF EXISTS idx_one_active_run_per_player');
  await backfillActiveRunMushrooms(sequelize);
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_player_mushroom
     ON game_run_players(player_id, mushroom_id)
     WHERE is_active = 1 AND mushroom_id IS NOT NULL`
  );
}

async function backfillActiveRunMushrooms(sequelize) {
  await sequelize.query(
    `UPDATE game_run_players
     SET mushroom_id = (
       SELECT pac.mushroom_id
       FROM player_active_character pac
       WHERE pac.player_id = game_run_players.player_id
     )
     WHERE mushroom_id IS NULL
       AND is_active = 1
       AND EXISTS (
         SELECT 1
         FROM player_active_character pac
         WHERE pac.player_id = game_run_players.player_id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM game_run_players existing
         JOIN player_active_character pac ON pac.player_id = existing.player_id
         WHERE existing.player_id = game_run_players.player_id
           AND existing.mushroom_id = pac.mushroom_id
           AND existing.is_active = 1
       )`
  );
}

async function ensureColumnExists(sequelize, table, column, definition) {
  if (sequelize.getDialect() === 'sqlite') {
    const rows = await sequelize.query(`PRAGMA table_info(${table})`, { type: QueryTypes.SELECT });
    if (rows.some((row) => row.name === column)) return;
    await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return;
  }
  await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

async function runQuery(sql, params = [], transaction = null) {
  const { sequelize } = await getDb();
  const { sql: rewrittenSql, replacements } = convertPlaceholders(sql, params);
  const options = {
    replacements,
    transaction
  };

  if (isSelect(rewrittenSql)) {
    const rows = await sequelize.query(rewrittenSql, {
      ...options,
      type: QueryTypes.SELECT
    });
    return {
      rows,
      rowCount: rows.length
    };
  }

  const [rows, metadata] = await sequelize.query(rewrittenSql, options);
  let rowCount = 0;
  if (typeof metadata?.rowCount === 'number') {
    rowCount = metadata.rowCount;
  } else if (typeof metadata?.changes === 'number') {
    rowCount = metadata.changes;
  } else if (Array.isArray(rows)) {
    rowCount = rows.length;
  } else if (isInsert(rewrittenSql) || isUpdate(rewrittenSql) || isDelete(rewrittenSql)) {
    rowCount = 1;
  }

  return {
    rows: Array.isArray(rows) ? rows : [],
    rowCount
  };
}

export async function getDb() {
  if (state) {
    return state;
  }

  const sequelize = await createSequelize();
  await sequelize.authenticate();
  await initSchema(sequelize);
  state = {
    sequelize,
    dialect: sequelize.getDialect()
  };
  return state;
}

let resetPromise = null;

export async function resetDb() {
  if (resetPromise) return resetPromise;
  resetPromise = _doReset().finally(() => { resetPromise = null; });
  return resetPromise;
}

async function _doReset() {
  const storagePath = state?.sequelize?.__storagePath || null;
  if (state?.sequelize) {
    await state.sequelize.close();
  }
  if (storagePath && storagePath !== ':memory:') {
    await fs.rm(storagePath, { force: true }).catch(() => {});
    await fs.rm(`${storagePath}-journal`, { force: true }).catch(() => {});
  }
  state = null;
  return getDb();
}

export async function withTransaction(work) {
  const { sequelize } = await getDb();
  return sequelize.transaction(async (transaction) => {
    const client = {
      query(sql, params = []) {
        return runQuery(sql, params, transaction);
      }
    };
    return work(client);
  });
}

export async function query(sql, params = [], client = null) {
  if (client?.query) {
    return client.query(sql, params);
  }
  return runQuery(sql, params, null);
}
