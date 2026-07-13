import { createTelegramBotGatewayPort } from '@microwavedev/backpack-game-core/server/ports/mushroom/platform';
import { createTelegramAuthCode, confirmTelegramAuthCode } from './auth.js';
import {
  completeTelegramSuccessfulPayment,
  getPaymentSupportLinks,
  validateTelegramPreCheckout
} from './services/wallet-service.js';

const botGatewayPort = createTelegramBotGatewayPort({
  createTelegramAuthCode,
  confirmTelegramAuthCode,
  completeTelegramSuccessfulPayment,
  getPaymentSupportLinks,
  validateTelegramPreCheckout,
  env: process.env,
  defaultFetch: globalThis.fetch,
  defaultMiniAppName: 'app',
  defaultGameShortName: 'mushroom_master',
  copy: {
    mentionText: 'Открыть Mushroom Battles и собрать первый бой.',
    paymentSupportText: [
      'Payment support: contact the Mushroom Battles team before opening a dispute.',
      'Wallet purchases are granted only after verified provider payment callbacks.',
      'Refunds and failed/late crypto payments are handled by support review.'
    ].join('\n'),
    launchText: 'Open the Mini App to continue.',
    authConfirmedText: 'Authentication confirmed. Return to the app.'
  }
});

export const {
  normalizeBotUsername,
  miniAppName,
  gameShortName,
  buildMiniAppLink,
  buildDmStartLink,
  createMentionReply,
  createTelegramInlineKeyboard,
  createPaymentSupportReply,
  buildGameLaunchUrl,
  buildTelegramGameScorePayload,
  callTelegramBotApi,
  buildWebhookUrl,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  ensureTelegramWebhook,
  answerTelegramGameCallback,
  reportTelegramGameScore,
  answerTelegramPreCheckoutQuery,
  sendTelegramMessage,
  createBrowserFallbackPayload,
  handleBotStartParam,
  handleTelegramWebhook
} = botGatewayPort;
