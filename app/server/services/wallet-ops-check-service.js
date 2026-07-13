import { createMushroomWalletOpsCheckServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import {
  auditWalletMirror,
  reconcileWalletPayments
} from './wallet-service.js';

const walletOpsCheckServicePort = createMushroomWalletOpsCheckServicePort({
  auditWalletMirror,
  reconcileWalletPayments,
  env: process.env,
  defaultFetch: globalThis.fetch
});

export const {
  runWalletOpsChecks,
  sendWalletOpsAlert
} = walletOpsCheckServicePort;
