import {
  createProfileRuntimeService,
  shapeAuthUserProfile
} from '@microwavedev/backpack-game-core/modules/auth';
import {
  loginWithDevSession,
  loginWithTelegram,
  loginWithWebSession
} from '../auth.js';
import { getBootstrap } from './game-service.js';
import {
  getPlayerState,
  selectActiveMushroom,
  updateSettings
} from './player-service.js';

export const profileRuntimeService = createProfileRuntimeService({
  loginProviders: {
    dev: (payload) => loginWithDevSession(payload),
    telegram: ({ initData, botToken }) => loginWithTelegram(initData, botToken),
    web: (payload) => loginWithWebSession(payload)
  },
  adapters: {
    getBootstrap: ({ playerId }) => getBootstrap(playerId),
    getProfile: ({ playerId }) => getPlayerState(playerId),
    setActiveCharacter: ({ playerId, characterId }) => selectActiveMushroom(playerId, characterId),
    updateSettings: ({ playerId, settings }) => updateSettings(playerId, settings)
  },
  presentPlayer: shapeAuthUserProfile,
  tokenField: 'sessionKey',
  userField: 'user'
});
