const readyStates = new Map();
const locks = new Map();

export function setReady(gameRunId, playerId) {
  if (!readyStates.has(gameRunId)) {
    readyStates.set(gameRunId, new Map());
  }
  readyStates.get(gameRunId).set(playerId, true);
}

export function setUnready(gameRunId, playerId) {
  const run = readyStates.get(gameRunId);
  if (run) {
    run.set(playerId, false);
  }
}

export function isReady(gameRunId, playerId) {
  const run = readyStates.get(gameRunId);
  return run ? run.get(playerId) === true : false;
}

export function areBothReady(gameRunId) {
  const run = readyStates.get(gameRunId);
  if (!run) return { ready: false, playerIds: null };

  const readyPlayers = [];
  for (const [playerId, ready] of run) {
    if (ready) readyPlayers.push(playerId);
  }

  if (readyPlayers.length >= 2) {
    return { ready: true, playerIds: readyPlayers.slice(0, 2) };
  }
  return { ready: false, playerIds: null };
}

export function clearRound(gameRunId) {
  const run = readyStates.get(gameRunId);
  if (run) {
    for (const playerId of run.keys()) {
      run.set(playerId, false);
    }
  }
}

export function clearRun(gameRunId) {
  readyStates.delete(gameRunId);
  locks.delete(gameRunId);
}

export async function withRunLock(gameRunId, fn) {
  while (locks.has(gameRunId)) {
    await locks.get(gameRunId);
  }
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  locks.set(gameRunId, promise);
  try {
    return await fn();
  } finally {
    locks.delete(gameRunId);
    resolve();
  }
}
