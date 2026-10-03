import { OAuth2Client } from 'google-auth-library';
import { createGoogleIdentityVerifier } from '@microwavedev/backpack-game-core/server';
import { upsertTelegramPlayer } from './auth.js';
import { query } from './db.js';

export function googleAuthConfig(env = process.env) {
  const requested = /^(1|true|yes)$/i.test(env.ENABLE_GOOGLE_AUTH || '');
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  const publicUrl = env.PUBLIC_GAME_URL || 'https://mushroombattles.com/';
  if (requested && !clientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('GOOGLE_CLIENT_ID must be a Google web client ID when Google sign-in is enabled');
  }
  return {
    enabled: requested,
    clientId: requested ? clientId : '',
    loginUri: requested ? new URL('/api/auth/google/callback', publicUrl).href : ''
  };
}

export function createGoogleLogin({ getConfig = googleAuthConfig, oauthClient = new OAuth2Client() } = {}) {
  return async ({ credential, lang } = {}) => {
    const config = getConfig();
    if (!config.enabled) {
      const error = new Error('Google sign-in is disabled');
      error.status = 403;
      throw error;
    }
    const identity = await createGoogleIdentityVerifier({ clientId: config.clientId, oauthClient })(credential);
    const existing = await query('SELECT lang FROM players WHERE telegram_id = $1', [`google:${identity.subject}`]);
    // The existing player store also keeps namespaced web IDs in telegram_id.
    // Only server-verified subjects can reach the separate google namespace.
    return upsertTelegramPlayer({
      id: `google:${identity.subject}`,
      first_name: identity.displayName,
      language_code: lang || existing.rows[0]?.lang || 'ru'
    }, 'google');
  };
}

export const loginWithGoogle = createGoogleLogin();
