import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  deriveHighestStoredSourceMessageId,
  readFetchState,
  writeFetchState
} from '../src/lib/fetch-state.js';

async function createTempDirs() {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mushroom-fetch-state-'));
  const messagesDir = path.join(baseDir, 'messages');
  const generatedDir = path.join(baseDir, 'generated');
  await fs.mkdir(messagesDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
  return {
    baseDir,
    messagesDir,
    generatedDir
  };
}

test('deriveHighestStoredSourceMessageId reads message ids from markdown filenames', async () => {
  const dirs = await createTempDirs();
  await fs.writeFile(path.join(dirs.messagesDir, '2026-03-27T23-31-44-000Z-5.md'), '# Message 5\n', 'utf8');
  await fs.writeFile(path.join(dirs.messagesDir, '2026-03-28T04-59-10-000Z-242.md'), '# Message 242\n', 'utf8');
  await fs.writeFile(path.join(dirs.messagesDir, 'notes.txt'), 'ignore me\n', 'utf8');

  const highest = await deriveHighestStoredSourceMessageId(dirs);
  assert.equal(highest, 242);

  await fs.rm(dirs.baseDir, { recursive: true, force: true });
});

test('readFetchState falls back to zero and persists written state', async () => {
  const dirs = await createTempDirs();

  assert.deepEqual(await readFetchState(dirs), { lastSeenSourceMessageId: 0 });

  await writeFetchState(dirs, { lastSeenSourceMessageId: 257 });
  assert.deepEqual(await readFetchState(dirs), { lastSeenSourceMessageId: 257 });

  await fs.rm(dirs.baseDir, { recursive: true, force: true });
});
