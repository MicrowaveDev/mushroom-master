import 'dotenv/config';
import path from 'path';
import express from 'express';
import OpenAI from 'openai';
import {
  authenticateRequest,
  createTelegramAuthCode,
  loginWithDevSession,
  loginWithTelegram,
  requireAuth,
  verifyTelegramAuthCode
} from './auth.js';
import { createMentionReply, createBrowserFallbackPayload, handleBotStartParam } from './bot-gateway.js';
import { getDb, resetDb, query as dbQuery } from './db.js';
import {
  acceptFriendChallenge,
  addFriendByCode,
  createBattle,
  createFriendChallenge,
  declineFriendChallenge,
  getBattle,
  getBattleHistory,
  getBootstrap,
  getInventoryReviewSamples,
  getFriendChallenge,
  getFriends,
  getLeaderboard,
  getPlayerState,
  saveArtifactLoadout,
  saveLocalTestRun,
  saveShopState,
  selectActiveMushroom,
  startGameRun,
  getActiveGameRun,
  abandonGameRun,
  getGameRun,
  resolveRound,
  refreshRunShop,
  sellRunItem,
  createRunChallenge,
  getGameRunHistory,
  updateSettings
} from './services/game-service.js';
import * as readyManager from './services/ready-manager.js';
import * as sseManager from './services/sse-manager.js';
import { getWikiEntry, getWikiHome } from './wiki.js';

const repoRoot = '/Users/microwavedev/workspace/mushroom-master';
const webDist = path.join(repoRoot, 'web/dist');

function isLocalAiLabEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'mushroom_game_bot';
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export async function createApp() {
  await getDb();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(authenticateRequest);

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });

  app.get('/api/app-config', (_req, res) => {
    res.json({
      success: true,
        data: {
        localAiLabEnabled: isLocalAiLabEnabled(),
        localDevAuthEnabled: process.env.NODE_ENV !== 'production'
      }
    });
  });

  app.post(
    '/api/auth/telegram',
    asyncRoute(async (req, res) => {
      const result = await loginWithTelegram(req.body.initData, process.env.TELEGRAM_BOT_TOKEN || '');
      res.json({
        success: true,
        data: {
          sessionKey: result.session.sessionKey,
          user: {
            id: result.player.id,
            telegramId: result.player.telegram_id,
            telegramUsername: result.player.telegram_username,
            name: result.player.name,
            lang: result.player.lang
          }
        }
      });
    })
  );

  app.post(
    '/api/auth/telegram/code',
    asyncRoute(async (_req, res) => {
      const payload = await createBrowserFallbackPayload(botUsername());
      res.json({ success: true, data: payload });
    })
  );

  app.post(
    '/api/auth/telegram/verify-code',
    asyncRoute(async (req, res) => {
      const result = await verifyTelegramAuthCode(req.body.privateCode);
      if (!result.success) {
        res.status(result.needsBotAuth ? 200 : 400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          sessionKey: result.session.sessionKey,
          user: {
            id: result.player.id,
            telegramId: result.player.telegram_id,
            telegramUsername: result.player.telegram_username,
            name: result.player.name,
            lang: result.player.lang
          }
        }
      });
    })
  );

  app.get(
    '/api/bootstrap',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getBootstrap(req.user.id);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/profile',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getPlayerState(req.user.id) });
    })
  );

  app.get(
    '/api/characters',
    asyncRoute(async (_req, res) => {
      const { mushrooms } = await import('./game-data.js');
      res.json({ success: true, data: { mushrooms } });
    })
  );

  app.get(
    '/api/artifacts',
    asyncRoute(async (_req, res) => {
      const { artifacts } = await import('./game-data.js');
      res.json({ success: true, data: { artifacts } });
    })
  );

  app.put(
    '/api/active-character',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await selectActiveMushroom(req.user.id, req.body.mushroomId)
      });
    })
  );

  app.put(
    '/api/shop-state',
    requireAuth,
    asyncRoute(async (req, res) => {
      await saveShopState(req.user.id, req.body);
      res.json({ success: true, data: null });
    })
  );

  app.put(
    '/api/artifact-loadout',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await saveArtifactLoadout(req.user.id, req.body.mushroomId, req.body.items)
      });
    })
  );

  app.post(
    '/api/settings',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await updateSettings(req.user.id, req.body) });
    })
  );

  app.post(
    '/api/battles',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await createBattle(req.user.id, req.body) });
    })
  );

  app.get(
    '/api/battles/history',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattleHistory(req.user.id) });
    })
  );

  app.get(
    '/api/battles/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattle(req.params.id, req.user.id) });
    })
  );

  app.get(
    '/api/friends',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getFriends(req.user.id) });
    })
  );

  app.post(
    '/api/friends/add-by-code',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await addFriendByCode(req.user.id, req.body.friendCode) });
    })
  );

  app.post(
    '/api/friends/challenges',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createFriendChallenge(req.user.id, req.body.friendPlayerId)
      });
    })
  );

  app.get(
    '/api/friends/challenges/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getFriendChallenge(req.params.id) });
    })
  );

  app.post(
    '/api/friends/challenges/:id/accept',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await acceptFriendChallenge(req.params.id, req.user.id) });
    })
  );

  app.post(
    '/api/friends/challenges/:id/decline',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await declineFriendChallenge(req.params.id, req.user.id) });
    })
  );

  app.get(
    '/api/leaderboard',
    requireAuth,
    asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await getLeaderboard() });
    })
  );

  app.post(
    '/api/game-run/start',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await startGameRun(req.user.id, req.body.mode || 'solo');
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/game-runs/history',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getGameRunHistory(req.user.id);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/game-run/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await getGameRun(req.params.id, req.user.id);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/challenge',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await createRunChallenge(req.user.id, req.body.friendPlayerId);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/abandon',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await abandonGameRun(req.user.id, req.params.id);
      if (data.mode === 'challenge') {
        sseManager.sendToOpponent(req.params.id, req.user.id, 'opponent_abandoned', { playerId: req.user.id });
        sseManager.removeRun(req.params.id);
        readyManager.clearRun(req.params.id);
      }
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/ready',
    requireAuth,
    asyncRoute(async (req, res) => {
      const gameRunId = req.params.id;
      const playerId = req.user.id;

      const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
      if (!runResult.rowCount) throw new Error('Game run not found or already ended');
      const mode = runResult.rows[0].mode;

      if (mode === 'solo') {
        const data = await resolveRound(playerId, gameRunId);
        return res.json({ success: true, data });
      }

      // Challenge mode
      const data = await readyManager.withRunLock(gameRunId, async () => {
        readyManager.setReady(gameRunId, playerId);
        sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: true });

        const check = readyManager.areBothReady(gameRunId);
        if (!check.ready) {
          return { waiting: true };
        }

        readyManager.clearRound(gameRunId);
        const result = await resolveRound(playerId, gameRunId);

        for (const pid of Object.keys(result.playerResults)) {
          sseManager.sendToPlayer(gameRunId, pid, 'round_result', result.playerResults[pid]);
        }

        if (result.runEnded) {
          sseManager.broadcast(gameRunId, 'run_ended', { endReason: result.endReason });
          sseManager.removeRun(gameRunId);
          readyManager.clearRun(gameRunId);
        }

        return result.playerResults[playerId] || result;
      });

      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/unready',
    requireAuth,
    asyncRoute(async (req, res) => {
      const gameRunId = req.params.id;
      const playerId = req.user.id;

      const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
      if (!runResult.rowCount) throw new Error('Game run not found');
      if (runResult.rows[0].mode === 'solo') throw new Error('Cannot unready in solo mode');

      readyManager.setUnready(gameRunId, playerId);
      sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: false });

      res.json({ success: true, data: { ready: false } });
    })
  );

  app.get('/api/game-run/:id/events', requireAuth, (req, res) => {
    const gameRunId = req.params.id;
    const playerId = req.user.id;
    sseManager.addConnection(gameRunId, playerId, res);
    req.on('close', () => {
      sseManager.removeConnection(gameRunId, playerId);
    });
  });

  app.post(
    '/api/game-run/:id/refresh-shop',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await refreshRunShop(req.user.id, req.params.id);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/game-run/:id/sell',
    requireAuth,
    asyncRoute(async (req, res) => {
      const data = await sellRunItem(req.user.id, req.params.id, req.body.artifactId);
      res.json({ success: true, data });
    })
  );

  app.get(
    '/api/wiki/home',
    asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await getWikiHome() });
    })
  );

  for (const section of ['characters', 'locations', 'factions', 'glossary']) {
    app.get(
      `/api/wiki/${section}/:slug`,
      asyncRoute(async (req, res) => {
        res.json({ success: true, data: await getWikiEntry(section, req.params.slug) });
      })
    );
  }

  app.get('/api/bot/discovery', (req, res) => {
    res.json({
      success: true,
      data: createMentionReply({
        botUsername: botUsername(),
        chatType: req.query.chatType || 'group'
      })
    });
  });

  app.post(
    '/api/bot/start',
    asyncRoute(async (req, res) => {
      const data = await handleBotStartParam(req.body.startParam, req.body.telegramUser);
      res.json({ success: true, data });
    })
  );

  app.post(
    '/api/local-tests/battle-narration',
    requireAuth,
    asyncRoute(async (req, res) => {
      if (!isLocalAiLabEnabled()) {
        res.status(404).json({ success: false, error: 'Local AI Test Lab is disabled in production' });
        return;
      }

      const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
      const results = [];
      const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

      for (const variant of variants) {
        if (!client) {
          results.push({
            variant,
            output: `[mock] ${variant.name}: ${req.body.fixtureNarration || 'No OpenAI key configured.'}`,
            latencyMs: 0,
            usedMock: true
          });
          continue;
        }

        const startedAt = Date.now();
        const response = await client.responses.create({
          model: variant.model || 'gpt-4.1-mini',
          input: `${variant.prompt}\n\nBattle fixture:\n${req.body.fixtureNarration}`
        });
        results.push({
          variant,
          output: response.output_text,
          latencyMs: Date.now() - startedAt,
          usedMock: false
        });
      }

      await saveLocalTestRun({
        fixtureNarration: req.body.fixtureNarration,
        variants,
        results
      });

      res.json({ success: true, data: { results } });
    })
  );

  if (process.env.NODE_ENV !== 'production') {
    app.post(
      '/api/dev/reset',
      asyncRoute(async (_req, res) => {
        await resetDb();
        res.json({
          success: true,
          data: { reset: true }
        });
      })
    );

    app.post(
      '/api/dev/session',
      asyncRoute(async (req, res) => {
        const verified = await loginWithDevSession({
          telegramId: req.body.telegramId || 999001,
          username: req.body.username || 'local_player',
          name: req.body.name || 'Local',
          lastName: req.body.lastName || 'Player',
          lang: req.body.lang || 'ru'
        });
        res.json({
          success: true,
          data: {
            sessionKey: verified.session.sessionKey,
            player: verified.player
          }
        });
      })
    );

    app.get(
      '/api/dev/inventory-review',
      requireAuth,
      asyncRoute(async (_req, res) => {
        res.json({
          success: true,
          data: await getInventoryReviewSamples()
        });
      })
    );
  }

  app.use('/data', express.static(path.join(repoRoot, 'data')));
  app.use(express.static(webDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.use((error, _req, res, _next) => {
    res.status(400).json({
      success: false,
      error: error.message || 'Unexpected error'
    });
  });

  return app;
}
