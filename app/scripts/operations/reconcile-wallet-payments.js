#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../../server/db.js';
import { reconcileWalletPayments } from '../../server/services/wallet-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

await getDb();

const result = await reconcileWalletPayments({
  limit: argValue('--limit', '100')
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
