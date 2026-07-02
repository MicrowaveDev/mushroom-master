#!/usr/bin/env node
import 'dotenv/config';
import { getDb } from '../server/db.js';
import { lookupMoneySupportRecords } from '../server/services/support-money-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function positionalQuery() {
  return process.argv.slice(2).find((arg) => !arg.startsWith('--')) || null;
}

const searchQuery = argValue('--query', positionalQuery());
const limit = argValue('--limit', '25');

if (!searchQuery) {
  // eslint-disable-next-line no-console
  console.error('Usage: npm run game:support:money-lookup -- --query=<player-or-provider-reference> [--limit=25]');
  process.exit(2);
}

await getDb();

const result = await lookupMoneySupportRecords({
  query: searchQuery,
  limit
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
