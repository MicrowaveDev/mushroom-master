import {
  createAssetGachaSimulationService
} from '@microwavedev/backpack-game-core/modules/gacha/simulation-service';
import {
  getAssetCatalog,
  getAssetPack,
  getPackOdds,
  getRuntimeAssetCatalog,
  getRuntimeAssetPack,
  shapeAssetPack
} from './asset-service.js';

const simulationService = createAssetGachaSimulationService({
  getStaticPack: getAssetPack,
  getStaticCatalog: getAssetCatalog,
  getStaticPackOdds: (pack) => getPackOdds(pack.id),
  getRuntimePack: getRuntimeAssetPack,
  getRuntimeCatalog: ({ planAssetVisibility }) => getRuntimeAssetCatalog({ planAssetVisibility }),
  shapeRuntimePackOdds: (pack, { catalog }) => shapeAssetPack(pack, { includeAssets: true, catalog })
});

export function simulateAssetPackOdds(packId, options = {}) {
  return simulationService.simulateAssetPackOdds(packId, options);
}

export async function simulateRuntimeAssetPackOdds(packId, {
  planAssetVisibility = 'runtime',
  ...options
} = {}) {
  return simulationService.simulateRuntimeAssetPackOdds(packId, {
    ...options,
    planAssetVisibility
  });
}
