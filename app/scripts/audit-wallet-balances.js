#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../server/db.js';
import {
  auditWalletMirror,
  backfillMissingWalletBalancesFromPlayers
} from '../server/services/wallet-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

await getDb();

const shouldFix = process.argv.includes('--fix');
const limit = Number(argValue('--limit', '100')) || 100;
let backfill = null;
if (shouldFix) {
  backfill = await backfillMissingWalletBalancesFromPlayers({ limit });
}

const audit = await auditWalletMirror({ limit });
const result = {
  ok: audit.total === 0,
  audit,
  backfill
};

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
process.exit(audit.total === 0 ? 0 : 1);
