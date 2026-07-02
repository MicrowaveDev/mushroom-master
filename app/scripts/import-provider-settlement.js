#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import { getDb } from '../server/db.js';
import { parseProviderSettlementInput } from '../server/services/provider-settlement-adapters.js';
import { importProviderSettlementRecords } from '../server/services/provider-settlement-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function usage() {
  return [
    'Usage:',
    '  npm run game:wallet:import-settlement -- --provider=btcpay --file=settlement.json [--format=json|csv|auto] [--source-ref=...] [--imported-by=...] [--dry-run]',
    '',
    'Reads normalized/provider JSON arrays or objects with records/data/payments/invoices/items/rows/transactions.',
    'CSV exports are supported for provider settlement rows when --format=csv or the file ends in .csv.'
  ].join('\n');
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
const sourceRef = argValue('--source-ref', file);
const parsedInput = parseProviderSettlementInput(await fs.readFile(file, 'utf8'), {
  provider,
  format: argValue('--format', 'auto'),
  sourceRef
});
const result = await importProviderSettlementRecords({
  provider,
  records: parsedInput.records,
  sourceType: parsedInput.format,
  sourceRef,
  importedBy: argValue('--imported-by'),
  metadata: {
    adapter: parsedInput.adapter,
    sourceFormat: parsedInput.format,
    rawRecordCount: parsedInput.rawRecordCount
  },
  dryRun: process.argv.includes('--dry-run')
});

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
process.exit(result.report.ok ? 0 : 1);
