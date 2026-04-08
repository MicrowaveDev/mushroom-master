const connections = new Map();

function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
  connections.get(gameRunId).set(playerId, res);
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
    for (const res of run.values()) {
      try { res.end(); } catch { /* ignore */ }
    }
    connections.delete(gameRunId);
  }
}

export function sendToPlayer(gameRunId, playerId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  const res = run.get(playerId);
  if (res) {
    try { res.write(formatSSE(event, data)); } catch { /* ignore */ }
  }
}

export function sendToOpponent(gameRunId, playerId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  for (const [pid, res] of run) {
    if (pid !== playerId) {
      try { res.write(formatSSE(event, data)); } catch { /* ignore */ }
    }
  }
}

export function broadcast(gameRunId, event, data) {
  const run = connections.get(gameRunId);
  if (!run) return;
  const msg = formatSSE(event, data);
  for (const res of run.values()) {
    try { res.write(msg); } catch { /* ignore */ }
  }
}
