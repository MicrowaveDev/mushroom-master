import fs from 'node:fs/promises';
import path from 'node:path';

function getFetchStatePath(dirs) {
  return path.join(dirs.generatedDir, '.fetch-state.json');
}

export async function readFetchState(dirs) {
  try {
    const raw = await fs.readFile(getFetchStatePath(dirs), 'utf8');
    const parsed = JSON.parse(raw);
    const lastSeenSourceMessageId = Number(parsed?.lastSeenSourceMessageId || 0);
    return {
      lastSeenSourceMessageId: Number.isInteger(lastSeenSourceMessageId) && lastSeenSourceMessageId > 0
        ? lastSeenSourceMessageId
        : 0
    };
  } catch {
    return { lastSeenSourceMessageId: 0 };
  }
}

export async function writeFetchState(dirs, state) {
  const nextState = {
    lastSeenSourceMessageId: Number(state?.lastSeenSourceMessageId || 0),
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(getFetchStatePath(dirs), `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
}

export async function deriveHighestStoredSourceMessageId(dirs) {
  let entries = [];
  try {
    entries = await fs.readdir(dirs.messagesDir);
  } catch {
    return 0;
  }

  let maxId = 0;
  for (const name of entries) {
    const match = String(name).match(/-(\d+)\.md$/);
    if (!match) {
      continue;
    }
    const messageId = Number(match[1]);
    if (Number.isInteger(messageId) && messageId > maxId) {
      maxId = messageId;
    }
  }

  return maxId;
}
