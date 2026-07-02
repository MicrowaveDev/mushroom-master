#!/usr/bin/env node
import 'dotenv/config';
import { simulateAssetPackOdds } from '../server/services/gacha-simulation-service.js';

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function usage() {
  return [
    'Usage:',
    '  npm run game:gacha:simulate -- [--pack=season_1_portraits] [--trials=10000] [--seed=season-review] [--owned=assetId,assetId]',
    '',
    'Prints JSON with configured odds, simulated observed odds, rarity summary, and authoring warnings.'
  ].join('\n');
}

if (process.argv.includes('--help') || process.argv.includes('help')) {
  // eslint-disable-next-line no-console
  console.log(usage());
  process.exit(0);
}

try {
  const result = simulateAssetPackOdds(argValue('--pack', 'season_1_portraits'), {
    trials: Number(argValue('--trials', '10000')),
    seed: argValue('--seed'),
    ownedAssetIds: parseCsv(argValue('--owned'))
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err.message);
  process.exit(1);
}
