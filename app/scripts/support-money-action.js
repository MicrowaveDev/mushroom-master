#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../server/db.js';
import {
  listSupportActions,
  supportAdjustWallet,
  supportFreezeAsset,
  supportGrantAsset,
  supportMarkPurchaseRefunded,
  supportRevokeAsset,
  supportUnfreezeAsset
} from '../server/services/support-ops-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function parseJsonArg(name) {
  const value = argValue(name);
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error(`${name} must be valid JSON: ${err.message}`);
  }
}

function usage() {
  return [
    'Usage:',
    '  npm run game:support:money-action -- wallet-grant --actor=<id> --player=<playerId> --amount=<n> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- wallet-revoke --actor=<id> --player=<playerId> --amount=<n> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- asset-grant --actor=<id> --player=<playerId> --asset=<assetId> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- asset-revoke --actor=<id> --player=<playerId> --asset=<assetId> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- asset-freeze --actor=<id> --player=<playerId> --asset=<assetId> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- asset-unfreeze --actor=<id> --player=<playerId> --asset=<assetId> [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- purchase-refund --actor=<id> --intent=<intentId> [--no-clawback] [--reason=...] [--note=...] [--evidence-json={}]',
    '  npm run game:support:money-action -- list [--player=<playerId>] [--target-type=...] [--target-id=...] [--limit=25]'
  ].join('\n');
}

const action = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!action || action === 'help' || action === '--help') {
  // eslint-disable-next-line no-console
  console.log(usage());
  process.exit(action ? 0 : 2);
}

await getDb();

const common = {
  actorId: argValue('--actor'),
  reason: argValue('--reason'),
  note: argValue('--note', ''),
  evidence: parseJsonArg('--evidence-json')
};

let result;
if (action === 'wallet-grant' || action === 'wallet-revoke') {
  result = await supportAdjustWallet({
    ...common,
    playerId: argValue('--player'),
    amount: argValue('--amount'),
    direction: action === 'wallet-revoke' ? 'revoke' : 'grant'
  });
} else if (action === 'asset-grant') {
  result = await supportGrantAsset({
    ...common,
    playerId: argValue('--player'),
    assetId: argValue('--asset')
  });
} else if (action === 'asset-revoke') {
  result = await supportRevokeAsset({
    ...common,
    playerId: argValue('--player'),
    assetId: argValue('--asset')
  });
} else if (action === 'asset-freeze') {
  result = await supportFreezeAsset({
    ...common,
    playerId: argValue('--player'),
    assetId: argValue('--asset')
  });
} else if (action === 'asset-unfreeze') {
  result = await supportUnfreezeAsset({
    ...common,
    playerId: argValue('--player'),
    assetId: argValue('--asset')
  });
} else if (action === 'purchase-refund') {
  result = await supportMarkPurchaseRefunded({
    ...common,
    intentId: argValue('--intent'),
    clawback: !process.argv.includes('--no-clawback')
  });
} else if (action === 'list') {
  result = await listSupportActions({
    playerId: argValue('--player'),
    targetType: argValue('--target-type'),
    targetId: argValue('--target-id'),
    limit: argValue('--limit', '25')
  });
} else {
  // eslint-disable-next-line no-console
  console.error(`Unknown support action: ${action}\n${usage()}`);
  process.exit(2);
}

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
