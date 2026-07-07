import {
  createRequestLogger,
  createStructuredLogger
} from '@microwavedev/backpack-game-core/server';

export const log = createStructuredLogger();

export function requestLogger() {
  return createRequestLogger({
    logger: log,
    contextFromRequest: (req) => ({
      playerId: req.user?.id || null,
      gameRunId: req.params?.id || null
    })
  });
}
