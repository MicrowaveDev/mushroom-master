import crypto from 'crypto';
import {
  chooseWeightedAssetCandidate,
  getAssetById,
  getAssetPack,
  getPackOdds,
  resolveAssetPackRollCandidates,
  selectAssetPackRollResults
} from './asset-service.js';

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeTrials(value) {
  const trials = Number(value || 10_000);
  if (!Number.isInteger(trials) || trials <= 0) {
    throw httpError('Simulation trials must be a positive integer', 400);
  }
  if (trials > 1_000_000) {
    throw httpError('Simulation trials cannot exceed 1000000', 400);
  }
  return trials;
}

function candidateWeight(candidate) {
  const weight = Number(candidate?.dropWeight || 0);
  return Number.isFinite(weight) ? Math.max(0, weight) : 0;
}

function createSimulationRng(seedInput) {
  const digest = crypto.createHash('sha256').update(String(seedInput || 'asset-pack-simulation')).digest();
  let state = digest.readUInt32LE(0);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function warning(code, message, details = {}) {
  return { code, message, ...details };
}

function configuredGuarantees(pack) {
  if (Array.isArray(pack.guarantees)) return pack.guarantees;
  if (Array.isArray(pack.guaranteeRules)) return pack.guaranteeRules;
  return [];
}

function summarizeRarities(items, trials) {
  const byRarity = new Map();
  for (const item of items) {
    const rarity = item.rarity || 'unknown';
    const current = byRarity.get(rarity) || {
      rarity,
      candidateCount: 0,
      expectedProbability: 0,
      observedProbability: 0,
      observedCount: 0
    };
    current.candidateCount += 1;
    current.expectedProbability += item.expectedProbability;
    current.observedCount += item.observedCount;
    current.observedProbability = current.observedCount / trials;
    byRarity.set(rarity, current);
  }
  return Array.from(byRarity.values());
}

export function simulateAssetPackOdds(packId, {
  trials = 10_000,
  seed = null,
  rng = null,
  ownedAssetIds = []
} = {}) {
  const pack = getAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);

  const trialCount = normalizeTrials(trials);
  const seedValue = seed || `${pack.id}:${trialCount}`;
  const random = rng || createSimulationRng(seedValue);
  const odds = getPackOdds(pack.id);
  const owned = ownedAssetIds instanceof Set ? ownedAssetIds : new Set(ownedAssetIds);
  const warnings = [];

  const missingAssetIds = pack.items
    .filter((item) => !getAssetById(item.assetId))
    .map((item) => item.assetId);
  if (missingAssetIds.length) {
    warnings.push(warning(
      'missing_asset_items',
      'Some pack items do not resolve to catalog assets and cannot roll.',
      { assetIds: missingAssetIds }
    ));
  }

  const ownedPackAssetIds = pack.items
    .filter((item) => owned.has(item.assetId) && getAssetById(item.assetId))
    .map((item) => item.assetId);
  if (ownedPackAssetIds.length) {
    warnings.push(warning(
      'owned_items_excluded',
      'Owned pack assets are excluded because duplicate inventory is not enabled yet.',
      { assetIds: ownedPackAssetIds }
    ));
  }

  const candidates = resolveAssetPackRollCandidates(pack, { ownedAssetIds: owned });
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidateWeight(candidate), 0);
  const zeroWeightAssetIds = candidates
    .filter((candidate) => candidateWeight(candidate) <= 0)
    .map((candidate) => candidate.assetId);
  if (zeroWeightAssetIds.length) {
    warnings.push(warning(
      'zero_weight_candidates',
      'Some unowned candidates have no positive weight and should not appear in simulation results.',
      { assetIds: zeroWeightAssetIds }
    ));
  }

  const counts = new Map(candidates.map((candidate) => [candidate.assetId, 0]));
  if (!candidates.length) {
    warnings.push(warning('no_unowned_candidates', 'No unowned assets are available for this pack.'));
  } else if (totalWeight <= 0) {
    warnings.push(warning('no_weighted_candidates', 'No unowned candidates have positive drop weight.'));
  } else if (Number(pack.rollSize || 1) === 1) {
    for (let i = 0; i < trialCount; i += 1) {
      const selected = chooseWeightedAssetCandidate(candidates, random);
      counts.set(selected.assetId, (counts.get(selected.assetId) || 0) + 1);
    }
  } else {
    for (let i = 0; i < trialCount; i += 1) {
      const selectedItems = selectAssetPackRollResults(candidates, pack, { rng: random });
      for (const selected of selectedItems) {
        counts.set(selected.assetId, (counts.get(selected.assetId) || 0) + 1);
      }
    }
  }
  const totalObservedSelections = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const averageItemsPerRoll = totalObservedSelections / trialCount;

  const items = candidates.map((candidate) => {
    const weight = candidateWeight(candidate);
    const observedCount = counts.get(candidate.assetId) || 0;
    const expectedProbability = Number(pack.rollSize || 1) === 1 && totalWeight > 0 ? weight / totalWeight : null;
    const observedProbability = observedCount / trialCount;
    return {
      assetId: candidate.assetId,
      rarity: candidate.rarity || candidate.asset?.rarity || null,
      dropWeight: weight,
      expectedProbability,
      observedProbability,
      observedCount,
      delta: expectedProbability === null ? null : observedProbability - expectedProbability,
      asset: {
        slot: candidate.asset.slot,
        targetType: candidate.asset.targetType,
        targetId: candidate.asset.targetId,
        variantId: candidate.asset.variantId,
        name: candidate.asset.name,
        price: candidate.asset.price,
        currencyCode: candidate.asset.currencyCode
      }
    };
  });

  return {
    packId: pack.id,
    seasonId: pack.seasonId,
    collectionId: pack.collectionId,
    name: pack.name,
    status: pack.status,
    active: odds.active,
    rollPriceCurrencyCode: pack.rollPriceCurrencyCode,
    rollPriceAmount: pack.rollPriceAmount,
    rollSize: pack.rollSize,
    averageItemsPerRoll,
    trials: trialCount,
    seed: rng ? null : seedValue,
    candidateCount: candidates.length,
    weightedCandidateCount: candidates.filter((candidate) => candidateWeight(candidate) > 0).length,
    totalWeight,
    rollable: candidates.length > 0 && totalWeight > 0,
    guarantees: {
      supported: false,
      configured: configuredGuarantees(pack),
      note: 'The current runtime supports unowned multi-slot openings; guarantee and pity simulation remains future work.'
    },
    warnings,
    raritySummary: summarizeRarities(items, trialCount),
    items
  };
}
