import { createServerGachaSimulationService } from '@microwavedev/backpack-game-core/server';
import {
  getAssetCatalog,
  getAssetPack,
  getPackOdds,
  getRuntimeAssetCatalog,
  getRuntimeAssetPack,
  shapeAssetPack
} from './asset-service.js';

const simulationService = createServerGachaSimulationService({
  getStaticPack: getAssetPack,
  getStaticCatalog: getAssetCatalog,
  getStaticPackOdds: (pack) => getPackOdds(pack.id),
  getRuntimePack: getRuntimeAssetPack,
  getRuntimeCatalog: ({ planAssetVisibility }) => getRuntimeAssetCatalog({ planAssetVisibility }),
  shapeRuntimePackOdds: (pack, { catalog }) => shapeAssetPack(pack, { includeAssets: true, catalog })
});

export const simulateAssetPackOdds = simulationService.simulateAssetPackOdds;
export const simulateRuntimeAssetPackOdds = simulationService.simulateRuntimeAssetPackOdds;
