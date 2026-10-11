import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('SQLite read-then-write transaction survives a competing connection writer', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mushroom-transaction-'));
  const storage = path.join(directory, 'contention.sqlite');
  // A file-backed child process isolates this regression from the unit suite's
  // in-memory database and reproduces the browser server's two connections.
  const script = `
    import assert from 'node:assert/strict';
    import sqlite3 from 'sqlite3';
    import { getDb, query, withTransaction } from './app/server/db.js';
    const { sequelize } = await getDb();
    await query('CREATE TABLE transaction_contention (value INTEGER NOT NULL)');
    await query('INSERT INTO transaction_contention (value) VALUES (0)');
    const competitor = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(process.env.SQLITE_STORAGE,
        (error) => error ? reject(error) : resolve(connection));
    });
    competitor.configure('busyTimeout', 3000);
    let competingWrite;
    await withTransaction(async (client) => {
      await client.query('SELECT value FROM transaction_contention');
      competingWrite = new Promise((resolve, reject) => {
        competitor.run('UPDATE transaction_contention SET value = value + 1',
          (error) => error ? reject(error) : resolve());
      });
      competingWrite.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 50));
      await client.query('UPDATE transaction_contention SET value = value + 1');
    });
    await competingWrite;
    const saved = await query('SELECT value FROM transaction_contention');
    assert.equal(saved.rows[0].value, 2);
    await new Promise((resolve, reject) => competitor.close((error) => error ? reject(error) : resolve()));
    await sequelize.close();
    process.stdout.write('both-writes-committed');
  `;
  try {
    const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: '', SQLITE_STORAGE: storage },
      timeout: 10000
    });
    assert.equal(stdout, 'both-writes-committed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
