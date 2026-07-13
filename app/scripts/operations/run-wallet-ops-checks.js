#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../../server/db.js';
import {
  runWalletOpsChecks,
  sendWalletOpsAlert
} from '../../server/services/wallet-ops-check-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function usage() {
  return [
    'Usage:',
    '  npm run game:wallet:ops-check -- [--limit=100] [--alert-webhook-url=https://...] [--no-alert]',
    '',
    'Runs wallet mirror and payment reconciliation checks for cron/monitoring.',
    'If issues are found and an alert webhook is configured, posts a JSON alert payload.'
  ].join('\n');
}

if (process.argv.includes('--help') || process.argv.includes('help')) {
  // eslint-disable-next-line no-console
  console.log(usage());
  process.exit(0);
}

await getDb();

const report = await runWalletOpsChecks({ limit: argValue('--limit', '100') });
let alert = { sent: false, reason: 'disabled' };
if (!process.argv.includes('--no-alert')) {
  alert = await sendWalletOpsAlert(report, {
    webhookUrl: argValue('--alert-webhook-url', process.env.WALLET_OPS_ALERT_WEBHOOK_URL || '')
  });
}

const result = { ...report, alert };

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
