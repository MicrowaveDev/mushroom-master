import {
  simulateAssetGachaPackOdds as simulateCoreAssetGachaPackOdds
} from '@microwavedev/backpack-game-core/modules/gacha/simulation';
import {
  getAssetCatalog,
  getAssetPack,
  getPackOdds,
  getRuntimeAssetCatalog,
  getRuntimeAssetPack,
  shapeAssetPack
} from './asset-service.js';

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function simulateResolvedAssetPackOdds(pack, {
  catalog,
  odds,
  source = 'static',
  ...options
} = {}) {
  return simulateCoreAssetGachaPackOdds(pack, {
    ...options,
    catalog,
    odds,
    source,
    maxTrials: 1_000_000
  });
}

export function simulateAssetPackOdds(packId, options = {}) {
  const pack = getAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  return simulateResolvedAssetPackOdds(pack, {
    ...options,
    catalog: getAssetCatalog(),
    odds: getPackOdds(pack.id),
    source: 'static'
  });
}

export async function simulateRuntimeAssetPackOdds(packId, {
  planAssetVisibility = 'runtime',
  ...options
} = {}) {
  const pack = await getRuntimeAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  const catalog = await getRuntimeAssetCatalog({ planAssetVisibility });
  return simulateResolvedAssetPackOdds(pack, {
    ...options,
    catalog,
    odds: shapeAssetPack(pack, { includeAssets: true, catalog }),
    source: pack.source || 'runtime'
  });
}
