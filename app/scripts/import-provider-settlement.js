#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import { getDb } from '../server/db.js';
import { importProviderSettlementRecords } from '../server/services/provider-settlement-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function usage() {
  return [
    'Usage:',
    '  npm run game:wallet:import-settlement -- --provider=btcpay --file=settlement.json [--source-ref=...] [--imported-by=...] [--dry-run]',
    '',
    'Reads normalized JSON settlement records as an array, or an object with records/data/payments.'
  ].join('\n');
}

function recordsFromJson(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.payments)) return value.payments;
  throw new Error('Settlement JSON must be an array or contain records/data/payments array');
}

if (process.argv.includes('--help') || process.argv.includes('help')) {
  // eslint-disable-next-line no-console
  console.log(usage());
  process.exit(0);
}

const provider = argValue('--provider');
const file = argValue('--file');
if (!provider || !file) {
  // eslint-disable-next-line no-console
  console.error(usage());
  process.exit(2);
}

await getDb();
const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
const result = await importProviderSettlementRecords({
  provider,
  records: recordsFromJson(parsed),
  sourceType: 'json',
  sourceRef: argValue('--source-ref', file),
  importedBy: argValue('--imported-by'),
  dryRun: process.argv.includes('--dry-run')
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
process.exit(result.report.ok ? 0 : 1);
