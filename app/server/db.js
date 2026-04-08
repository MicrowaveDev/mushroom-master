import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { QueryTypes, Sequelize } from 'sequelize';
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
    : path.resolve('/Users/microwavedev/workspace/mushroom-master', relativePath);
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

export async function resetDb() {
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
