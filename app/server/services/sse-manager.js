const connections = new Map();
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTION_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

let heartbeatTimer = null;
let onHeartbeatCallback = null;

/** Register a callback invoked on every heartbeat tick (for idle-run sweeps). */
export function onHeartbeat(fn) {
  onHeartbeatCallback = fn;
}

function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [gameRunId, run] of connections) {
      for (const [playerId, entry] of run) {
        // Prune stale connections
        if (now - entry.connectedAt > MAX_CONNECTION_AGE_MS) {
          try { entry.res.end(); } catch { /* ignore */ }
          run.delete(playerId);
          continue;
        }
        // Send heartbeat
        try {
          entry.res.write(':heartbeat\n\n');
        } catch {
          run.delete(playerId);
        }
      }
      if (run.size === 0) {
        connections.delete(gameRunId);
      }
    }
    // Invoke idle-run sweep callback (e.g. challenge timeout detection)
    if (onHeartbeatCallback) {
      try { onHeartbeatCallback(); } catch { /* logged elsewhere */ }
    }

    // Stop timer if no connections remain
    if (connections.size === 0) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, HEARTBEAT_INTERVAL_MS);
  // Allow the process to exit even if the timer is running
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

export function addConnection(gameRunId, playerId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(':ok\n\n');

  if (!connections.has(gameRunId)) {
    connections.set(gameRunId, new Map());
  }
  connections.get(gameRunId).set(playerId, { res, connectedAt: Date.now() });
  startHeartbeat();
}

export function removeConnection(gameRunId, playerId) {
  const run = connections.get(gameRunId);
  if (run) {
    run.delete(playerId);
    if (run.size === 0) {
      connections.delete(gameRunId);
    }
  }
}

export function removeRun(gameRunId) {
  const run = connections.get(gameRunId);
  if (run) {
    for (const entry of run.values()) {
      try { entry.res.end(); } catch { /* ignore */ }
    }
    connections.delete(gameRunId);
  }
}

export function sendToPlayer(gameRunId, playerId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  const entry = run.get(playerId);
  if (entry) {
    try { entry.res.write(formatSSE(event, data)); } catch { /* ignore */ }
  }
}

export function sendToOpponent(gameRunId, playerId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  for (const [pid, entry] of run) {
    if (pid !== playerId) {
      try { entry.res.write(formatSSE(event, data)); } catch { /* ignore */ }
    }
  }
}

export function broadcast(gameRunId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  const msg = formatSSE(event, data);
  for (const entry of run.values()) {
    try { entry.res.write(msg); } catch { /* ignore */ }
  }
}
