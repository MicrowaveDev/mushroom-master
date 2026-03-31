import { createTelegramAuthCode, confirmTelegramAuthCode } from './auth.js';

export function buildMiniAppLink(botUsername, startapp) {
  return `https://t.me/${botUsername}/${startapp ? `app?startapp=${encodeURIComponent(startapp)}` : 'app'}`;
}

export function buildDmStartLink(botUsername, startParam) {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(startParam)}`;
}

export function createMentionReply({ botUsername, chatType = 'group' }) {
  const playLink = buildMiniAppLink(botUsername, `entry_${chatType}`);
  return {
    text: 'Открыть грибной автобаттлер и собрать первый бой.',
    ctas: [
      { label: 'Play', url: playLink },
      { label: 'Start in DM', url: buildDmStartLink(botUsername, 'play') }
    ]
  };
}

export async function createBrowserFallbackPayload(botUsername) {
  const authCode = await createTelegramAuthCode();
  return {
    ...authCode,
    botUsername,
    botUrl: buildDmStartLink(botUsername, `auth-${authCode.publicCode}`),
    expiresInSeconds: 600
  };
}

export async function handleBotStartParam(startParam, telegramUser) {
  if (!startParam?.startsWith('auth-')) {
    return {
      kind: 'launch',
      text: 'Open the Mini App to continue.'
    };
  }

  const publicCode = startParam.replace(/^auth-/, '');
  await confirmTelegramAuthCode(publicCode, telegramUser);
  return {
    kind: 'auth_confirmed',
    text: 'Authentication confirmed. Return to the app.'
  };
}
