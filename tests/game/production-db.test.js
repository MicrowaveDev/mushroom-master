import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { repoRoot } from '../../app/shared/repo-root.js';

test('[production-db] production refuses to boot without PostgreSQL DATABASE_URL', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import('./app/server/db.js').then((m) => m.getDb()).catch((err) => { console.error(err.message); process.exit(42); })"
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: '',
        SQLITE_STORAGE: 'tmp/production-should-not-use-sqlite.sqlite'
      },
      encoding: 'utf8'
    }
  );

  assert.equal(result.status, 42);
  assert.match(result.stderr, /DATABASE_URL is required in production/);
});
