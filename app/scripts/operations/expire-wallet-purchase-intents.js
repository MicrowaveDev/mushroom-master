#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../../server/db.js';
import { expireStalePurchaseIntents } from '../../server/services/wallet-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function usage() {
  return [
    'Usage:',
    '  npm run game:wallet:expire-intents -- [--older-than-hours=24] [--older-than-ms=86400000] [--limit=100] [--dry-run]',
    '',
    'Marks stale pending wallet purchase intents expired without granting wallet currency.'
  ].join('\n');
}

if (process.argv.includes('--help') || process.argv.includes('help')) {
  // eslint-disable-next-line no-console
  console.log(usage());
  process.exit(0);
}

await getDb();

const olderThanMsArg = argValue('--older-than-ms');
const olderThanHoursArg = argValue('--older-than-hours');
const olderThanMs = olderThanMsArg != null
  ? Number(olderThanMsArg)
  : olderThanHoursArg != null
    ? Number(olderThanHoursArg) * 60 * 60 * 1000
    : null;

const result = await expireStalePurchaseIntents({
  olderThanMs,
  limit: argValue('--limit', '100'),
  dryRun: process.argv.includes('--dry-run')
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
