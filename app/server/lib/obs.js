import crypto from 'crypto';

const DISABLED = process.env.NODE_ENV === 'test' || process.env.LOG_SILENT === '1';

function emit(level, payload) {
  if (DISABLED) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...payload });
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const log = {
  info: (payload) => emit('info', payload),
  warn: (payload) => emit('warn', payload),
  error: (payload) => emit('error', payload)
};

function newRequestId() {
  return 'req_' + crypto.randomBytes(6).toString('hex');
}

export function requestLogger() {
  return function requestLoggerMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || newRequestId();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const outcome = res.statusCode >= 500 ? 'server_error'
        : res.statusCode >= 400 ? 'client_error'
        : 'ok';
      log.info({
        kind: 'http',
        requestId,
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        outcome,
        playerId: req.user?.id || null,
        gameRunId: req.params?.id || null
      });
    });

    next();
  };
}
