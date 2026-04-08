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

/**
 * Proper async mutex using promise chaining.
 * Each call chains onto the previous lock holder's promise,
 * ensuring true mutual exclusion even under concurrent awaits.
 */
export async function withRunLock(gameRunId, fn) {
  let releaseLock;
  const lockPromise = new Promise((resolve) => { releaseLock = resolve; });

  // Chain onto whatever is currently queued (or resolve immediately if nothing)
  const previousLock = locks.get(gameRunId) || Promise.resolve();
  locks.set(gameRunId, lockPromise);

  // Wait for the previous holder to finish
  await previousLock;

  try {
    return await fn();
  } finally {
    // If we're still the tail of the chain, clean up the entry
    if (locks.get(gameRunId) === lockPromise) {
      locks.delete(gameRunId);
    }
    releaseLock();
  }
}
