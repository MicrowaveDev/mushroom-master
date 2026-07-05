import {
  gachaAdminDraftDiffRows,
  gachaAdminFixtureOperationRows,
  gachaAdminPlanChanceText,
  gachaAdminPlanCoverageRows,
  gachaAdminPlanTotalWeight,
  gachaAdminReleaseChecklistRows,
  gachaAdminSimulationItemRows,
  gachaAdminValidationIssueRows,
  shapeGachaAdminOddsTableSections
} from '@microwavedev/backpack-game-core/client-view-model';
import { GachaOddsTable } from '@microwavedev/backpack-game-core/vue/components';

const SUPPORT_ADMIN_STORAGE_KEY = 'supportAdminCredentials';

function readStoredCredentials() {
  try {
    return JSON.parse(sessionStorage.getItem(SUPPORT_ADMIN_STORAGE_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function writeStoredCredentials({ token, actorId, approvalActorId }) {
  sessionStorage.setItem(SUPPORT_ADMIN_STORAGE_KEY, JSON.stringify({
    token: String(token || ''),
    actorId: String(actorId || ''),
    approvalActorId: String(approvalActorId || '')
  }));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function rowPlayerLabel(player) {
  if (!player) return '';
  return player.telegramUsername || player.name || player.friendCode || player.id;
}

function localizedName(value) {
  if (!value || typeof value !== 'object') return '';
  return value.en || value.ru || Object.values(value).find(Boolean) || '';
}

function prettyJson(value, fallback) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function parseJsonInput(value, fallback, label) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function nullableText(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function makeDefaultGachaItemDraft() {
  return {
    assetId: '',
    rarity: 'common',
    dropWeight: 100,
    copyLimit: '',
    metadataJson: '{}'
  };
}

const DEFAULT_GACHA_FORM = {
  seasonId: '',
  seasonName: '',
  seasonStatus: 'active',
  seasonStartsAt: '',
  seasonEndsAt: '',
  collectionId: '',
  collectionName: '',
  collectionStatus: 'active',
  collectionStartsAt: '',
  collectionEndsAt: '',
  packId: '',
  packName: '',
  packStatus: 'future',
  packStartsAt: '',
  packEndsAt: '',
  rollPriceAmount: 25,
  rollSize: 2,
  rarityTableVersion: '',
  rarityWeightsJson: prettyJson({ common: 70, rare: 25, epic: 5 }, {}),
  slotsJson: prettyJson([
    { rarityWeights: { common: 1 } },
    { rarityWeights: { rare: 1 } }
  ], []),
  guaranteesJson: '[]',
  pityRulesJson: '[]',
  duplicatePolicyJson: prettyJson({ mode: 'unowned_only' }, {}),
  burnRulesJson: '[]',
  metadataJson: '{}',
  reason: 'gacha_admin_ui',
  note: ''
};

async function supportJson(path, { token, actorId, approvalActorId = '', method = 'GET', body = null }) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      'x-support-actor-id': actorId,
      ...(approvalActorId ? { 'x-support-approval-actor-id': approvalActorId } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) {
    throw new Error(json.error || `Support request failed (${response.status})`);
  }
  return json.data;
}

export const SupportAdminScreen = {
  name: 'SupportAdminScreen',
  components: {
    GachaOddsTable
  },
  data() {
    const credentials = readStoredCredentials();
    return {
      activeAdminTab: 'support',
      token: credentials.token || '',
      actorId: credentials.actorId || '',
      approvalActorId: credentials.approvalActorId || '',
      query: '',
      limit: 25,
      lookup: null,
      loading: false,
      actionLoading: false,
      error: '',
      status: '',
      walletForm: {
        playerId: '',
        direction: 'grant',
        amount: 25,
        reason: 'support_adjustment',
        note: ''
      },
      assetForm: {
        playerId: '',
        action: 'grant',
        assetId: '',
        assetInstanceId: '',
        reason: 'support_asset_review',
        note: ''
      },
      refundForm: {
        intentId: '',
        clawback: true,
        reason: 'support_refund',
        note: ''
      },
      gachaCatalog: null,
      gachaLoading: false,
      gachaActionLoading: false,
      gachaValidation: null,
      gachaPreview: null,
      gachaSimulationTrials: 1000,
      gachaFixtureJson: '',
      gachaFixtureDryRun: true,
      gachaFixtureAllowApproved: false,
      gachaFixtureResult: null,
      gachaAdvancedOpen: false,
      gachaPlanForm: {
        seasonId: '',
        characterId: '',
        rarity: 'common',
        dropWeight: 100,
        status: 'planned',
        promotePackId: '',
        files: []
      },
      gachaForm: { ...DEFAULT_GACHA_FORM },
      gachaItemDrafts: [makeDefaultGachaItemDraft()]
    };
  },
  computed: {
    counts() {
      return this.lookup?.counts || {};
    },
    playerOptions() {
      return this.lookup?.players || [];
    },
    selectedBalance() {
      const playerId = this.walletForm.playerId;
      return (this.lookup?.walletBalances || []).find((row) => row.playerId === playerId) || null;
    },
    latestTransactions() {
      return (this.lookup?.walletTransactions || []).slice(0, 8);
    },
    latestPurchases() {
      return (this.lookup?.purchaseIntents || []).slice(0, 8);
    },
    latestActions() {
      return (this.lookup?.supportActions || []).slice(0, 10);
    },
    latestAssets() {
      return (this.lookup?.assetInstances || []).slice(0, 8);
    },
    latestRolls() {
      return (this.lookup?.assetRolls || []).slice(0, 6);
    },
    latestWebhookEvents() {
      return (this.lookup?.paymentWebhookEvents || []).slice(0, 6);
    },
    gachaSeasons() {
      return this.gachaCatalog?.seasons || [];
    },
    gachaCollections() {
      return this.gachaCatalog?.collections || [];
    },
    gachaPacks() {
      return this.gachaCatalog?.packs || [];
    },
    gachaAssetOptions() {
      return this.gachaCatalog?.assetOptions || [];
    },
    gachaPlanItems() {
      return this.gachaCatalog?.planItems || [];
    },
    gachaPlanCharacters() {
      return this.gachaCatalog?.planCharacters || [];
    },
    gachaSelectedPlanItems() {
      const seasonId = this.gachaPlanForm.seasonId || this.gachaForm.seasonId;
      return this.gachaPlanItems.filter((item) => item.seasonId === seasonId && item.status !== 'archived');
    },
    gachaPlanReadyItems() {
      return this.gachaSelectedPlanItems.filter((item) => item.status === 'ready');
    },
    gachaPlanPacks() {
      const seasonId = this.gachaPlanForm.seasonId || this.gachaForm.seasonId;
      return this.gachaPacks.filter((pack) => !seasonId || pack.seasonId === seasonId);
    },
    gachaPlanSelectedPack() {
      return this.gachaPlanPacks.find((pack) => pack.id === this.gachaPlanForm.promotePackId) || null;
    },
    gachaPlanTotalWeight() {
      return gachaAdminPlanTotalWeight(this.gachaSelectedPlanItems);
    },
    gachaPlanCoverage() {
      return gachaAdminPlanCoverageRows(this.gachaSelectedPlanItems, {
        characters: this.gachaPlanCharacters,
        targetPerCharacter: this.gachaCatalog?.planSummary?.targetPerCharacter || 5
      });
    },
    selectedGachaPack() {
      return this.gachaPacks.find((pack) => pack.id === this.gachaForm.packId) || null;
    },
    selectedGachaPackItems() {
      const packId = this.gachaForm.packId;
      return (this.gachaCatalog?.items || []).filter((item) => item.packId === packId);
    },
    filteredGachaCollections() {
      const seasonId = this.gachaForm.seasonId;
      return this.gachaCollections.filter((collection) => !seasonId || collection.seasonId === seasonId);
    },
    gachaValidationResult() {
      return this.gachaValidation?.validation || this.selectedGachaPack?.validation || null;
    },
    gachaValidationIssues() {
      return gachaAdminValidationIssueRows(this.gachaValidationResult);
    },
    gachaReleaseChecklist() {
      return this.gachaPreview?.releaseChecklist || this.selectedGachaPack?.releaseChecklist || null;
    },
    gachaReleaseItems() {
      return gachaAdminReleaseChecklistRows(this.gachaReleaseChecklist);
    },
    gachaReleaseBlockers() {
      return this.gachaReleaseChecklist?.blockers || [];
    },
    gachaReleaseWarnings() {
      return this.gachaReleaseChecklist?.warnings || [];
    },
    gachaOddsPreview() {
      return this.gachaPreview?.preview || this.gachaValidation?.preview || null;
    },
    gachaOddsTables() {
      return shapeGachaAdminOddsTableSections(this.gachaOddsPreview, {
        labels: {
          rarity: 'Rarity',
          expected: 'Expected',
          items: 'Items',
          weight: 'Weight',
          asset: 'Asset',
          copyCap: 'Copy Cap'
        }
      });
    },
    gachaSimulation() {
      return this.gachaPreview?.simulation || null;
    },
    gachaSimulationItems() {
      return gachaAdminSimulationItemRows(this.gachaSimulation);
    },
    gachaDraftDiff() {
      return this.gachaPreview?.diff || this.gachaValidation?.diff || null;
    },
    gachaDraftDiffRows() {
      return gachaAdminDraftDiffRows(this.gachaDraftDiff);
    },
    gachaAssetPolicyRecommendations() {
      return this.gachaPreview?.assetPolicyRecommendations || this.gachaValidation?.assetPolicyRecommendations || [];
    },
    gachaFixtureOperations() {
      return gachaAdminFixtureOperationRows(this.gachaFixtureResult);
    },
    gachaFixtureSummary() {
      return this.gachaFixtureResult?.summary || null;
    },
    canLoadGachaCatalog() {
      return this.token.trim() && this.actorId.trim() && !this.gachaLoading;
    },
    canRunGachaFixtureImport() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaFixtureJson.trim()
        && !this.gachaActionLoading;
    },
    canUploadGachaPlanItems() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaPlanForm.seasonId.trim()
        && this.gachaPlanForm.characterId.trim()
        && this.gachaPlanForm.files.length
        && Number.isInteger(Number(this.gachaPlanForm.dropWeight))
        && Number(this.gachaPlanForm.dropWeight) > 0
        && !this.gachaActionLoading;
    },
    canPromoteGachaPlanItems() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaPlanForm.seasonId.trim()
        && this.gachaPlanSelectedPack
        && this.gachaPlanReadyItems.length
        && !this.gachaActionLoading;
    },
    canSubmitGachaSeason() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaForm.seasonId.trim()
        && this.gachaForm.seasonName.trim()
        && !this.gachaActionLoading;
    },
    canSubmitGachaCollection() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaForm.seasonId.trim()
        && this.gachaForm.collectionId.trim()
        && this.gachaForm.collectionName.trim()
        && !this.gachaActionLoading;
    },
    canSubmitGachaPack() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaForm.seasonId.trim()
        && this.gachaForm.collectionId.trim()
        && this.gachaForm.packId.trim()
        && this.gachaForm.packName.trim()
        && Number.isInteger(Number(this.gachaForm.rollPriceAmount))
        && Number(this.gachaForm.rollPriceAmount) > 0
        && Number.isInteger(Number(this.gachaForm.rollSize))
        && Number(this.gachaForm.rollSize) > 0
        && !this.gachaActionLoading;
    },
    canSubmitGachaItems() {
      return this.token.trim()
        && this.actorId.trim()
        && this.gachaForm.packId.trim()
        && this.gachaItemDrafts.some((item) => item.assetId.trim())
        && !this.gachaActionLoading;
    },
    assetInstanceOptions() {
      const playerId = this.assetForm.playerId;
      return (this.lookup?.assetInstances || [])
        .filter((asset) => !playerId || asset.playerId === playerId)
        .slice(0, 25);
    },
    selectedAssetInstance() {
      return this.assetInstanceOptions.find((asset) => asset.id === this.assetForm.assetInstanceId) || null;
    },
    refundIntentOptions() {
      return (this.lookup?.purchaseIntents || []).slice(0, 25);
    },
    selectedRefundIntent() {
      return this.refundIntentOptions.find((intent) => intent.id === this.refundForm.intentId) || null;
    },
    canSubmitLookup() {
      return this.token.trim() && this.actorId.trim() && this.query.trim() && !this.loading;
    },
    canSubmitWalletAction() {
      return this.token.trim()
        && this.actorId.trim()
        && this.walletForm.playerId.trim()
        && Number.isInteger(Number(this.walletForm.amount))
        && Number(this.walletForm.amount) > 0
        && this.walletForm.reason.trim()
        && !this.actionLoading;
    },
    canSubmitAssetAction() {
      const action = this.assetForm.action;
      const needsAssetId = action === 'grant' || !this.assetForm.assetInstanceId.trim();
      return this.token.trim()
        && this.actorId.trim()
        && this.assetForm.playerId.trim()
        && ['grant', 'freeze', 'unfreeze', 'revoke'].includes(action)
        && (!needsAssetId || this.assetForm.assetId.trim())
        && (action === 'grant' || this.assetForm.assetId.trim() || this.assetForm.assetInstanceId.trim())
        && this.assetForm.reason.trim()
        && !this.actionLoading;
    },
    canSubmitRefundAction() {
      return this.token.trim()
        && this.actorId.trim()
        && this.refundForm.intentId.trim()
        && this.refundForm.reason.trim()
        && !this.actionLoading;
    }
  },
  methods: {
    formatDate,
    rowPlayerLabel,
    localizedName,
    prettyJson,
    formatPercent(value) {
      const numeric = Number(value || 0);
      return `${(numeric * 100).toFixed(numeric > 0 && numeric < 0.01 ? 2 : 1)}%`;
    },
    formatGachaPlanChance(item) {
      return gachaAdminPlanChanceText(item, { totalWeight: this.gachaPlanTotalWeight });
    },
    compactJson(value) {
      if (value === null || value === undefined) return '-';
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
      return JSON.stringify(value);
    },
    setAdminTab(tab) {
      this.activeAdminTab = tab === 'gacha' ? 'gacha' : 'support';
      if (this.activeAdminTab === 'gacha' && !this.gachaCatalog && this.canLoadGachaCatalog) {
        this.loadGachaCatalog({ silent: true });
      }
    },
    gachaAssetLabel(asset) {
      if (!asset) return '';
      const name = localizedName(asset.name) || asset.assetId;
      return `${name} · ${asset.rarity || 'common'} · ${asset.assetId}`;
    },
    gachaPlanCharacterLabel(characterId) {
      return this.gachaPlanCharacters.find((character) => character.id === characterId)?.label || characterId;
    },
    gachaSeasonLabel(season) {
      if (!season) return '';
      return `${localizedName(season.name) || season.id} · ${season.status}`;
    },
    gachaCollectionLabel(collection) {
      if (!collection) return '';
      return `${localizedName(collection.name) || collection.id} · ${collection.status}`;
    },
    findGachaAsset(assetId) {
      return this.gachaAssetOptions.find((asset) => asset.assetId === assetId) || null;
    },
    applyGachaAssetOption(index) {
      const draft = this.gachaItemDrafts[index];
      if (!draft) return;
      const asset = this.findGachaAsset(draft.assetId);
      if (!asset) return;
      draft.rarity = asset.rarity || draft.rarity || 'common';
      draft.dropWeight = Number(asset.dropWeight || draft.dropWeight || 1);
    },
    handleGachaPlanFiles(event) {
      this.gachaPlanForm.files = Array.from(event.target.files || []);
    },
    addGachaItemDraft() {
      this.gachaItemDrafts.push(makeDefaultGachaItemDraft());
    },
    removeGachaItemDraft(index) {
      this.gachaItemDrafts.splice(index, 1);
      if (!this.gachaItemDrafts.length) this.addGachaItemDraft();
    },
    fillGachaSeason(season) {
      if (!season) return;
      this.gachaForm.seasonId = season.id;
      this.gachaForm.seasonName = localizedName(season.name);
      this.gachaForm.seasonStatus = season.status || 'draft';
      this.gachaForm.seasonStartsAt = season.startsAt || '';
      this.gachaForm.seasonEndsAt = season.endsAt || '';
    },
    fillGachaCollection(collection) {
      if (!collection) return;
      this.gachaForm.collectionId = collection.id;
      this.gachaForm.seasonId = collection.seasonId || this.gachaForm.seasonId;
      this.gachaForm.collectionName = localizedName(collection.name);
      this.gachaForm.collectionStatus = collection.status || 'draft';
      this.gachaForm.collectionStartsAt = collection.startsAt || '';
      this.gachaForm.collectionEndsAt = collection.endsAt || '';
    },
    selectGachaSeasonById(seasonId) {
      this.fillGachaSeason(this.gachaSeasons.find((season) => season.id === seasonId));
    },
    selectGachaCollectionById(collectionId) {
      this.fillGachaCollection(this.gachaCollections.find((collection) => collection.id === collectionId));
    },
    fillGachaPack(pack) {
      if (!pack) return;
      this.gachaForm.packId = pack.id;
      this.gachaForm.seasonId = pack.seasonId || '';
      this.gachaForm.collectionId = pack.collectionId || '';
      this.gachaForm.packName = localizedName(pack.name);
      this.gachaForm.packStatus = pack.status || 'future';
      this.gachaForm.packStartsAt = pack.startsAt || '';
      this.gachaForm.packEndsAt = pack.endsAt || '';
      this.gachaForm.rollPriceAmount = Number(pack.rollPriceAmount || 1);
      this.gachaForm.rollSize = Number(pack.rollSize || 1);
      this.gachaForm.rarityTableVersion = pack.rarityTableVersion || '';
      this.gachaForm.rarityWeightsJson = prettyJson(pack.rarityWeights, null);
      this.gachaForm.slotsJson = prettyJson(pack.slots, null);
      this.gachaForm.guaranteesJson = prettyJson(pack.guarantees, null);
      this.gachaForm.pityRulesJson = prettyJson(pack.pityRules, null);
      this.gachaForm.duplicatePolicyJson = prettyJson(pack.duplicatePolicy, null);
      this.gachaForm.burnRulesJson = prettyJson(pack.burnRules, null);
      this.gachaForm.metadataJson = prettyJson(pack.metadata, {});
      const items = (this.gachaCatalog?.items || []).filter((item) => item.packId === pack.id);
      this.gachaItemDrafts = items.length ? items.map((item) => ({
        assetId: item.assetId,
        rarity: item.rarity || 'common',
        dropWeight: Number(item.dropWeight || 1),
        copyLimit: item.copyLimit == null ? '' : Number(item.copyLimit),
        metadataJson: prettyJson(item.metadata, {})
      })) : [makeDefaultGachaItemDraft()];
      this.gachaValidation = { validation: pack.validation };
      this.gachaPreview = pack.releaseChecklist
        ? { releaseChecklist: pack.releaseChecklist, validation: pack.validation }
        : null;
    },
    assetInstanceLabel(asset) {
      if (!asset) return '';
      return `${asset.assetId} · ${asset.status} · ${asset.id}`;
    },
    purchaseIntentLabel(intent) {
      if (!intent) return '';
      return `${intent.status} · ${intent.provider} · ${intent.walletAmount} ${intent.currencyCode} · ${intent.id}`;
    },
    setWalletDirection(direction) {
      this.walletForm.direction = direction === 'revoke' ? 'revoke' : 'grant';
    },
    setAssetAction(action) {
      this.assetForm.action = ['grant', 'freeze', 'unfreeze', 'revoke'].includes(action) ? action : 'grant';
    },
    applyLookupDefaults() {
      const playerId = this.lookup?.players?.[0]?.id || '';
      if (playerId) {
        if (!this.walletForm.playerId) this.walletForm.playerId = playerId;
        if (!this.assetForm.playerId) this.assetForm.playerId = playerId;
      }
      const preferredIntent = this.refundIntentOptions.find((intent) => intent.status === 'completed')
        || this.refundIntentOptions[0]
        || null;
      if (!this.refundForm.intentId && preferredIntent?.id) {
        this.refundForm.intentId = preferredIntent.id;
      }
    },
    syncAssetFromInstance() {
      const selected = this.selectedAssetInstance;
      if (!selected) return;
      this.assetForm.assetId = selected.assetId;
      this.assetForm.playerId = selected.playerId;
    },
    supportRequest(path, { method = 'GET', body = null } = {}) {
      return supportJson(path, {
        token: this.token.trim(),
        actorId: this.actorId.trim(),
        approvalActorId: this.approvalActorId.trim(),
        method,
        body
      });
    },
    gachaReasonPayload() {
      return {
        reason: this.gachaForm.reason.trim() || 'gacha_admin_ui',
        note: this.gachaForm.note.trim()
      };
    },
    buildGachaSeasonPayload() {
      return {
        id: this.gachaForm.seasonId.trim(),
        name: { en: this.gachaForm.seasonName.trim() },
        status: this.gachaForm.seasonStatus,
        startsAt: nullableText(this.gachaForm.seasonStartsAt),
        endsAt: nullableText(this.gachaForm.seasonEndsAt),
        metadata: {},
        ...this.gachaReasonPayload()
      };
    },
    buildGachaCollectionPayload() {
      return {
        id: this.gachaForm.collectionId.trim(),
        seasonId: this.gachaForm.seasonId.trim(),
        name: { en: this.gachaForm.collectionName.trim() },
        status: this.gachaForm.collectionStatus,
        startsAt: nullableText(this.gachaForm.collectionStartsAt),
        endsAt: nullableText(this.gachaForm.collectionEndsAt),
        metadata: {},
        ...this.gachaReasonPayload()
      };
    },
    buildGachaPackPayload() {
      return {
        id: this.gachaForm.packId.trim(),
        seasonId: this.gachaForm.seasonId.trim(),
        collectionId: this.gachaForm.collectionId.trim(),
        name: { en: this.gachaForm.packName.trim() },
        status: this.gachaForm.packStatus,
        startsAt: nullableText(this.gachaForm.packStartsAt),
        endsAt: nullableText(this.gachaForm.packEndsAt),
        rollPriceCurrencyCode: 'soft_coin',
        rollPriceAmount: Number(this.gachaForm.rollPriceAmount),
        rollSize: Number(this.gachaForm.rollSize),
        rarityTableVersion: nullableText(this.gachaForm.rarityTableVersion),
        rarityWeights: parseJsonInput(this.gachaForm.rarityWeightsJson, null, 'Rarity weights'),
        slots: parseJsonInput(this.gachaForm.slotsJson, null, 'Slots'),
        guarantees: parseJsonInput(this.gachaForm.guaranteesJson, null, 'Guarantees'),
        pityRules: parseJsonInput(this.gachaForm.pityRulesJson, null, 'Pity rules'),
        duplicatePolicy: parseJsonInput(this.gachaForm.duplicatePolicyJson, null, 'Duplicate policy'),
        burnRules: parseJsonInput(this.gachaForm.burnRulesJson, null, 'Burn rules'),
        metadata: parseJsonInput(this.gachaForm.metadataJson, {}, 'Pack metadata'),
        ...this.gachaReasonPayload()
      };
    },
    buildGachaItemPayload() {
      return this.gachaItemDrafts
        .filter((item) => item.assetId.trim())
        .map((item, index) => ({
          assetId: item.assetId.trim(),
          rarity: item.rarity,
          dropWeight: Number(item.dropWeight),
          ...(item.copyLimit === '' || item.copyLimit === null || item.copyLimit === undefined
            ? {}
            : { copyLimit: Number(item.copyLimit) }),
          itemOrder: index,
          metadata: parseJsonInput(item.metadataJson, {}, `Item ${index + 1} metadata`)
        }));
    },
    rememberCredentials() {
      writeStoredCredentials({
        token: this.token.trim(),
        actorId: this.actorId.trim(),
        approvalActorId: this.approvalActorId.trim()
      });
    },
    async runLookup() {
      if (!this.canSubmitLookup) return;
      this.loading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const params = new URLSearchParams({
          query: this.query.trim(),
          limit: String(this.limit || 25)
        });
        this.lookup = await this.supportRequest(`/api/admin/support/money-lookup?${params.toString()}`);
        this.applyLookupDefaults();
        this.status = 'Lookup complete.';
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    async loadGachaCatalog({ silent = false } = {}) {
      if (!this.canLoadGachaCatalog) return;
      this.gachaLoading = true;
      this.error = '';
      if (!silent) this.status = '';
      this.rememberCredentials();
      const previousPackId = this.gachaForm.packId;
      try {
        this.gachaCatalog = await this.supportRequest('/api/admin/gacha/catalog');
        const selectedPack = this.gachaPacks.find((pack) => pack.id === previousPackId) || this.gachaPacks[0] || null;
        if (selectedPack) this.fillGachaPack(selectedPack);
        if (!this.gachaForm.seasonId && this.gachaSeasons[0]) this.fillGachaSeason(this.gachaSeasons[0]);
        if (!this.gachaForm.collectionId && this.gachaCollections[0]) this.fillGachaCollection(this.gachaCollections[0]);
        if (!this.gachaPlanForm.seasonId && this.gachaSeasons[0]) this.gachaPlanForm.seasonId = this.gachaSeasons[0].id;
        if (!this.gachaPlanForm.characterId && this.gachaPlanCharacters[0]) this.gachaPlanForm.characterId = this.gachaPlanCharacters[0].id;
        if (!this.gachaPlanSelectedPack && this.gachaPlanPacks[0]) this.gachaPlanForm.promotePackId = this.gachaPlanPacks[0].id;
        if (!silent) this.status = 'Gacha catalog loaded.';
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaLoading = false;
      }
    },
    async submitGachaSeason() {
      if (!this.canSubmitGachaSeason) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const payload = this.buildGachaSeasonPayload();
        const exists = this.gachaSeasons.some((season) => season.id === payload.id);
        const data = await this.supportRequest(exists
          ? `/api/admin/gacha/seasons/${encodeURIComponent(payload.id)}`
          : '/api/admin/gacha/seasons', {
          method: exists ? 'PATCH' : 'POST',
          body: payload
        });
        this.status = exists ? 'Gacha season updated.' : 'Gacha season created.';
        this.fillGachaSeason(data.season);
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async uploadGachaPlanImages() {
      if (!this.canUploadGachaPlanItems) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const files = [...this.gachaPlanForm.files];
        for (const file of files) {
          const imageData = await fileToDataUrl(file);
          await this.supportRequest('/api/admin/gacha/plan-items', {
            method: 'POST',
            body: {
              seasonId: this.gachaPlanForm.seasonId.trim(),
              characterId: this.gachaPlanForm.characterId.trim(),
              rarity: this.gachaPlanForm.rarity,
              dropWeight: Number(this.gachaPlanForm.dropWeight),
              status: this.gachaPlanForm.status,
              fileName: file.name,
              imageData,
              ...this.gachaReasonPayload()
            }
          });
        }
        this.gachaPlanForm.files = [];
        const input = this.$refs.gachaPlanFileInput;
        if (input) input.value = '';
        this.status = files.length === 1 ? 'Gacha plan image uploaded.' : `${files.length} gacha plan images uploaded.`;
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async updateGachaPlanItem(item) {
      if (!item?.id || !this.canLoadGachaCatalog) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        await this.supportRequest(`/api/admin/gacha/plan-items/${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          body: {
            seasonId: item.seasonId,
            characterId: item.characterId,
            rarity: item.rarity,
            dropWeight: Number(item.dropWeight),
            status: item.status,
            ...this.gachaReasonPayload()
          }
        });
        this.status = 'Gacha plan item updated.';
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async deleteGachaPlanItem(item) {
      if (!item?.id || !this.canLoadGachaCatalog) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        await this.supportRequest(`/api/admin/gacha/plan-items/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          body: this.gachaReasonPayload()
        });
        this.status = 'Gacha plan item removed.';
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async promoteGachaPlanItems() {
      if (!this.canPromoteGachaPlanItems) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const data = await this.supportRequest(`/api/admin/gacha/packs/${encodeURIComponent(this.gachaPlanForm.promotePackId)}/promote-plan-items`, {
          method: 'POST',
          body: {
            seasonId: this.gachaPlanForm.seasonId,
            planItemIds: this.gachaPlanReadyItems.map((item) => item.id),
            ...this.gachaReasonPayload()
          }
        });
        const count = (data.inserted || []).length + (data.updated || []).length;
        this.status = data.cloned
          ? `${count} plan images added to draft pack ${data.packId}.`
          : `${count} plan images added to pack.`;
        this.gachaForm.packId = data.packId || this.gachaPlanForm.promotePackId;
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async submitGachaCollection() {
      if (!this.canSubmitGachaCollection) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const payload = this.buildGachaCollectionPayload();
        const exists = this.gachaCollections.some((collection) => collection.id === payload.id);
        const data = await this.supportRequest(exists
          ? `/api/admin/gacha/collections/${encodeURIComponent(payload.id)}`
          : '/api/admin/gacha/collections', {
          method: exists ? 'PATCH' : 'POST',
          body: payload
        });
        this.status = exists ? 'Gacha collection updated.' : 'Gacha collection created.';
        this.fillGachaCollection(data.collection);
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async submitGachaPack() {
      if (!this.canSubmitGachaPack) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const payload = this.buildGachaPackPayload();
        const exists = this.gachaPacks.some((pack) => pack.id === payload.id);
        const data = await this.supportRequest(exists
          ? `/api/admin/gacha/packs/${encodeURIComponent(payload.id)}`
          : '/api/admin/gacha/packs', {
          method: exists ? 'PATCH' : 'POST',
          body: payload
        });
        this.status = data.cloned
          ? `Approved pack cloned to draft ${data.pack.id}.`
          : (exists ? 'Gacha pack updated.' : 'Gacha pack created.');
        this.fillGachaPack(data.pack);
        this.gachaValidation = { validation: data.validation };
        this.gachaPreview = null;
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async submitGachaItems() {
      if (!this.canSubmitGachaItems) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const items = this.buildGachaItemPayload();
        const data = await this.supportRequest(`/api/admin/gacha/packs/${encodeURIComponent(this.gachaForm.packId.trim())}/items`, {
          method: 'PUT',
          body: {
            items,
            cloneDraft: true,
            ...this.gachaReasonPayload()
          }
        });
        if (data.packId) this.gachaForm.packId = data.packId;
        this.status = data.cloned
          ? `Items saved to cloned draft ${data.packId}.`
          : 'Gacha pack items saved.';
        this.gachaValidation = { validation: data.validation };
        this.gachaPreview = null;
        await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async validateGachaPack() {
      if (!this.gachaForm.packId.trim() || !this.canLoadGachaCatalog) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const params = new URLSearchParams({
          trials: String(this.gachaSimulationTrials || 1000)
        });
        this.gachaPreview = await this.supportRequest(`/api/admin/gacha/packs/${encodeURIComponent(this.gachaForm.packId.trim())}/preview?${params.toString()}`);
        this.gachaValidation = this.gachaPreview;
        this.status = this.gachaPreview.releaseChecklist?.ok
          ? 'Gacha release preview passed.'
          : 'Gacha release preview found blockers or warnings.';
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async exportGachaFixture() {
      if (!this.canLoadGachaCatalog) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const fixture = await this.supportRequest('/api/admin/gacha/export');
        this.gachaFixtureJson = prettyJson(fixture, {});
        this.gachaFixtureResult = null;
        this.status = 'Gacha fixture exported.';
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async importGachaFixture({ dryRun = this.gachaFixtureDryRun } = {}) {
      if (!this.canRunGachaFixtureImport) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const fixture = parseJsonInput(this.gachaFixtureJson, {}, 'Gacha fixture');
        const data = await this.supportRequest('/api/admin/gacha/import', {
          method: 'POST',
          body: {
            fixture,
            dryRun,
            allowApproved: this.gachaFixtureAllowApproved,
            ...this.gachaReasonPayload()
          }
        });
        this.gachaFixtureResult = data;
        this.status = data.dryRun ? 'Gacha fixture dry run complete.' : 'Gacha fixture import applied.';
        if (!data.dryRun) await this.loadGachaCatalog({ silent: true });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async transitionGachaPack(action) {
      if (!this.gachaForm.packId.trim() || !this.canLoadGachaCatalog) return;
      this.gachaActionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const data = await this.supportRequest(`/api/admin/gacha/packs/${encodeURIComponent(this.gachaForm.packId.trim())}/transition`, {
          method: 'POST',
          body: {
            action,
            ...this.gachaReasonPayload()
          }
        });
        this.status = `Gacha pack ${action} applied.`;
        this.fillGachaPack(data.pack);
        this.gachaValidation = { validation: data.validation };
        await this.loadGachaCatalog({ silent: true });
        this.gachaPreview = data.releaseChecklist
          ? {
            releaseChecklist: data.releaseChecklist,
            validation: data.validation,
            preview: data.preview,
            simulation: data.simulation,
            assetPolicyRecommendations: data.assetPolicyRecommendations,
            diff: data.diff
          }
          : null;
        this.gachaValidation = this.gachaPreview || { validation: data.validation };
      } catch (error) {
        this.error = error.message;
      } finally {
        this.gachaActionLoading = false;
      }
    },
    async submitWalletAction() {
      if (!this.canSubmitWalletAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      const direction = this.walletForm.direction === 'revoke' ? 'revoke' : 'grant';
      try {
        const data = await this.supportRequest(`/api/admin/support/actions/wallet-${direction}`, {
          method: 'POST',
          body: {
            playerId: this.walletForm.playerId.trim(),
            amount: Number(this.walletForm.amount),
            reason: this.walletForm.reason.trim(),
            note: this.walletForm.note.trim(),
            evidence: { source: 'support_admin_ui' }
          }
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.walletForm.playerId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    },
    async submitAssetAction() {
      if (!this.canSubmitAssetAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      const action = this.assetForm.action;
      try {
        const body = {
          playerId: this.assetForm.playerId.trim(),
          reason: this.assetForm.reason.trim(),
          note: this.assetForm.note.trim(),
          evidence: { source: 'support_admin_ui' }
        };
        if (this.assetForm.assetId.trim()) body.assetId = this.assetForm.assetId.trim();
        if (this.assetForm.assetInstanceId.trim()) body.assetInstanceId = this.assetForm.assetInstanceId.trim();
        const data = await this.supportRequest(`/api/admin/support/actions/asset-${action}`, {
          method: 'POST',
          body
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.assetForm.playerId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    },
    async submitRefundAction() {
      if (!this.canSubmitRefundAction) return;
      this.actionLoading = true;
      this.error = '';
      this.status = '';
      this.rememberCredentials();
      try {
        const data = await this.supportRequest('/api/admin/support/actions/purchase-refund', {
          method: 'POST',
          body: {
            intentId: this.refundForm.intentId.trim(),
            clawback: this.refundForm.clawback !== false,
            reason: this.refundForm.reason.trim(),
            note: this.refundForm.note.trim(),
            evidence: { source: 'support_admin_ui' }
          }
        });
        this.status = `${data.action.actionType} applied.`;
        this.query = this.refundForm.intentId.trim();
        await this.runLookup();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.actionLoading = false;
      }
    }
  },
  template: `
    <section class="support-admin-screen stack" data-testid="support-admin-screen">
      <header class="support-admin-header">
        <div>
          <p class="support-admin-kicker">Operations</p>
          <h2>Support Console</h2>
        </div>
        <p v-if="status" class="support-admin-message support-admin-message--ok" data-testid="support-admin-status">{{ status }}</p>
        <p v-if="error" class="support-admin-message support-admin-message--error" data-testid="support-admin-error">{{ error }}</p>
      </header>

      <nav class="support-admin-tabs" data-testid="support-admin-tabs" aria-label="Admin console areas">
        <button type="button" data-testid="support-admin-support-tab" :class="{ active: activeAdminTab === 'support' }" @click="setAdminTab('support')">Support</button>
        <button type="button" data-testid="support-admin-gacha-tab" :class="{ active: activeAdminTab === 'gacha' }" @click="setAdminTab('gacha')">Gacha</button>
      </nav>

      <template v-if="activeAdminTab === 'support'">
      <section class="panel support-admin-panel support-admin-lookup">
        <label>
          <span>Token</span>
          <input class="support-admin-input" data-testid="support-token" type="password" v-model="token" autocomplete="off" />
        </label>
        <label>
          <span>Actor</span>
          <input class="support-admin-input" data-testid="support-actor" v-model="actorId" autocomplete="off" />
        </label>
        <label>
          <span>Approval</span>
          <input class="support-admin-input" data-testid="support-approval-actor" v-model="approvalActorId" autocomplete="off" />
        </label>
        <label class="support-admin-query">
          <span>Lookup</span>
          <input class="support-admin-input" data-testid="support-query" v-model="query" @keydown.enter.prevent="runLookup" />
        </label>
        <label>
          <span>Limit</span>
          <input class="support-admin-input" data-testid="support-limit" type="number" min="1" max="100" v-model.number="limit" />
        </label>
        <button class="primary support-admin-submit" data-testid="support-lookup-submit" type="button" :disabled="!canSubmitLookup" @click="runLookup">
          {{ loading ? 'Searching' : 'Lookup' }}
        </button>
      </section>

      <section v-if="lookup" class="panel support-admin-panel" data-testid="support-counts">
        <h3>Record Counts</h3>
        <dl class="support-admin-metrics">
          <div><dt>Players</dt><dd>{{ counts.players || 0 }}</dd></div>
          <div><dt>Balances</dt><dd>{{ counts.walletBalances || 0 }}</dd></div>
          <div><dt>Purchases</dt><dd>{{ counts.purchaseIntents || 0 }}</dd></div>
          <div><dt>Transactions</dt><dd>{{ counts.walletTransactions || 0 }}</dd></div>
          <div><dt>Actions</dt><dd>{{ counts.supportActions || 0 }}</dd></div>
          <div><dt>Assets</dt><dd>{{ counts.assetInstances || 0 }}</dd></div>
        </dl>
      </section>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Players</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-players-table">
              <thead><tr><th>Player</th><th>Telegram</th><th>Mirror</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="player in lookup.players" :key="player.id" :data-player-id="player.id">
                  <td><strong>{{ rowPlayerLabel(player) }}</strong><small>{{ player.id }}</small></td>
                  <td>{{ player.telegramId || '-' }}</td>
                  <td>{{ player.walletMirrorBalance }}</td>
                  <td>{{ formatDate(player.createdAt) }}</td>
                </tr>
                <tr v-if="!lookup.players.length"><td colspan="4">No players found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel support-admin-wallet" data-testid="support-wallet-form">
          <h3>Wallet Adjustment</h3>
          <label>
            <span>Player</span>
            <select class="support-admin-input" data-testid="support-wallet-player" v-model="walletForm.playerId">
              <option value="">Select player</option>
              <option v-for="player in playerOptions" :key="player.id" :value="player.id">{{ rowPlayerLabel(player) }} · {{ player.id }}</option>
            </select>
          </label>
          <p class="support-admin-balance" data-testid="support-selected-balance">
            Balance: <strong>{{ selectedBalance ? selectedBalance.balance : 0 }}</strong>
          </p>
          <div class="support-admin-segment" role="group" aria-label="Wallet action">
            <button type="button" :class="{ active: walletForm.direction === 'grant' }" @click="setWalletDirection('grant')">Grant</button>
            <button type="button" :class="{ active: walletForm.direction === 'revoke' }" data-testid="support-wallet-revoke-mode" @click="setWalletDirection('revoke')">Revoke</button>
          </div>
          <label>
            <span>Amount</span>
            <input class="support-admin-input" data-testid="support-wallet-amount" type="number" min="1" step="1" v-model.number="walletForm.amount" />
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-wallet-reason" v-model="walletForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-wallet-note" rows="3" v-model="walletForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-wallet-submit" type="button" :disabled="!canSubmitWalletAction" @click="submitWalletAction">
            {{ actionLoading ? 'Applying' : 'Apply' }}
          </button>
        </section>
      </div>

      <div v-if="lookup" class="support-admin-columns support-admin-operator-columns">
        <section class="panel support-admin-panel support-admin-action-form" data-testid="support-asset-form">
          <h3>Asset Actions</h3>
          <label>
            <span>Player</span>
            <select class="support-admin-input" data-testid="support-asset-player" v-model="assetForm.playerId">
              <option value="">Select player</option>
              <option v-for="player in playerOptions" :key="player.id" :value="player.id">{{ rowPlayerLabel(player) }} · {{ player.id }}</option>
            </select>
          </label>
          <div class="support-admin-segment support-admin-segment--four" role="group" aria-label="Asset action">
            <button type="button" :class="{ active: assetForm.action === 'grant' }" data-testid="support-asset-grant-mode" @click="setAssetAction('grant')">Grant</button>
            <button type="button" :class="{ active: assetForm.action === 'freeze' }" data-testid="support-asset-freeze-mode" @click="setAssetAction('freeze')">Freeze</button>
            <button type="button" :class="{ active: assetForm.action === 'unfreeze' }" data-testid="support-asset-unfreeze-mode" @click="setAssetAction('unfreeze')">Unfreeze</button>
            <button type="button" :class="{ active: assetForm.action === 'revoke' }" data-testid="support-asset-revoke-mode" @click="setAssetAction('revoke')">Revoke</button>
          </div>
          <label>
            <span>Asset ID</span>
            <input class="support-admin-input" data-testid="support-asset-id" v-model="assetForm.assetId" />
          </label>
          <label>
            <span>Instance</span>
            <select class="support-admin-input" data-testid="support-asset-instance" v-model="assetForm.assetInstanceId" @change="syncAssetFromInstance">
              <option value="">Use asset id</option>
              <option v-for="asset in assetInstanceOptions" :key="asset.id" :value="asset.id">{{ assetInstanceLabel(asset) }}</option>
            </select>
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-asset-reason" v-model="assetForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-asset-note" rows="3" v-model="assetForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-asset-submit" type="button" :disabled="!canSubmitAssetAction" @click="submitAssetAction">
            {{ actionLoading ? 'Applying' : 'Apply Asset Action' }}
          </button>
        </section>

        <section class="panel support-admin-panel support-admin-action-form" data-testid="support-refund-form">
          <h3>Purchase Refund</h3>
          <label>
            <span>Intent</span>
            <select class="support-admin-input" data-testid="support-refund-intent" v-model="refundForm.intentId">
              <option value="">Select purchase intent</option>
              <option v-for="intent in refundIntentOptions" :key="intent.id" :value="intent.id">{{ purchaseIntentLabel(intent) }}</option>
            </select>
          </label>
          <p v-if="selectedRefundIntent" class="support-admin-balance" data-testid="support-refund-intent-summary">
            {{ selectedRefundIntent.status }} · {{ selectedRefundIntent.walletAmount }} {{ selectedRefundIntent.currencyCode }} · {{ selectedRefundIntent.provider }}
          </p>
          <label class="support-admin-checkbox">
            <input type="checkbox" data-testid="support-refund-clawback" v-model="refundForm.clawback" />
            <span>Claw back wallet balance</span>
          </label>
          <label>
            <span>Reason</span>
            <input class="support-admin-input" data-testid="support-refund-reason" v-model="refundForm.reason" />
          </label>
          <label>
            <span>Note</span>
            <textarea class="support-admin-input" data-testid="support-refund-note" rows="3" v-model="refundForm.note"></textarea>
          </label>
          <button class="primary support-admin-submit" data-testid="support-refund-submit" type="button" :disabled="!canSubmitRefundAction" @click="submitRefundAction">
            {{ actionLoading ? 'Applying' : 'Mark Refunded' }}
          </button>
        </section>
      </div>

      <section v-if="lookup" class="panel support-admin-panel">
        <h3>Wallet Transactions</h3>
        <div class="support-admin-table-wrap">
          <table class="support-admin-table" data-testid="support-wallet-transactions">
            <thead><tr><th>Amount</th><th>Balance</th><th>Reason</th><th>Source</th><th>Created</th></tr></thead>
            <tbody>
              <tr v-for="tx in latestTransactions" :key="tx.id">
                <td>{{ tx.amount }}</td>
                <td>{{ tx.balanceAfter }}</td>
                <td>{{ tx.reason }}</td>
                <td>{{ tx.sourceType || '-' }}<small>{{ tx.sourceId || tx.id }}</small></td>
                <td>{{ formatDate(tx.createdAt) }}</td>
              </tr>
              <tr v-if="!latestTransactions.length"><td colspan="5">No wallet transactions found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="lookup" class="panel support-admin-panel">
        <h3>Purchase Intents</h3>
        <div class="support-admin-table-wrap">
          <table class="support-admin-table" data-testid="support-purchase-intents">
            <thead><tr><th>Status</th><th>Provider</th><th>Wallet</th><th>Price</th><th>Invoice</th><th>Updated</th></tr></thead>
            <tbody>
              <tr v-for="intent in latestPurchases" :key="intent.id">
                <td>{{ intent.status }}</td>
                <td>{{ intent.provider }}</td>
                <td>{{ intent.walletAmount }} {{ intent.currencyCode }}</td>
                <td>{{ intent.priceAmount }} {{ intent.priceCurrency }}</td>
                <td>{{ intent.providerInvoiceId || '-' }}<small>{{ intent.id }}</small></td>
                <td>{{ formatDate(intent.updatedAt) }}</td>
              </tr>
              <tr v-if="!latestPurchases.length"><td colspan="6">No purchase intents found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Assets</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-assets-table">
              <thead><tr><th>Asset</th><th>Status</th><th>Source</th><th>Acquired</th></tr></thead>
              <tbody>
                <tr v-for="asset in latestAssets" :key="asset.id">
                  <td>{{ asset.assetId }}<small>{{ asset.id }}</small></td>
                  <td>{{ asset.status }}</td>
                  <td>{{ asset.acquisitionSource }}</td>
                  <td>{{ formatDate(asset.acquiredAt) }}</td>
                </tr>
                <tr v-if="!latestAssets.length"><td colspan="4">No assets found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel">
          <h3>Support Actions</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-actions-table">
              <thead><tr><th>Action</th><th>Actor</th><th>Reason</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="action in latestActions" :key="action.id">
                  <td>{{ action.actionType }}<small>{{ action.id }}</small></td>
                  <td>{{ action.actorId }}</td>
                  <td>{{ action.reason || '-' }}</td>
                  <td>{{ formatDate(action.createdAt) }}</td>
                </tr>
                <tr v-if="!latestActions.length"><td colspan="4">No support actions found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div v-if="lookup" class="support-admin-columns">
        <section class="panel support-admin-panel">
          <h3>Pack Rolls</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-rolls-table">
              <thead><tr><th>Pack</th><th>Result</th><th>Price</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="roll in latestRolls" :key="roll.id">
                  <td>{{ roll.packId }}<small>{{ roll.id }}</small></td>
                  <td>{{ roll.resultAssetIds?.length ? roll.resultAssetIds.join(', ') : (roll.selectedAssetId || '-') }}</td>
                  <td>{{ roll.priceAmount }} {{ roll.currencyCode }}</td>
                  <td>{{ formatDate(roll.createdAt) }}</td>
                </tr>
                <tr v-if="!latestRolls.length"><td colspan="4">No pack rolls found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel support-admin-panel">
          <h3>Webhook Events</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table" data-testid="support-webhook-table">
              <thead><tr><th>Provider</th><th>Status</th><th>Event</th><th>Processed</th></tr></thead>
              <tbody>
                <tr v-for="event in latestWebhookEvents" :key="event.id">
                  <td>{{ event.provider }}</td>
                  <td>{{ event.processingStatus }}</td>
                  <td>{{ event.eventKey }}<small>{{ event.id }}</small></td>
                  <td>{{ formatDate(event.processedAt || event.receivedAt) }}</td>
                </tr>
                <tr v-if="!latestWebhookEvents.length"><td colspan="4">No webhook events found.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </template>

      <template v-else>
        <section class="panel support-admin-panel support-admin-lookup support-admin-gacha-auth" data-testid="gacha-admin-auth">
          <label>
            <span>Token</span>
            <input class="support-admin-input" data-testid="gacha-token" type="password" v-model="token" autocomplete="off" />
          </label>
          <label>
            <span>Actor</span>
            <input class="support-admin-input" data-testid="gacha-actor" v-model="actorId" autocomplete="off" />
          </label>
          <label>
            <span>Approval</span>
            <input class="support-admin-input" data-testid="gacha-approval-actor" v-model="approvalActorId" autocomplete="off" />
          </label>
          <button class="primary support-admin-submit" data-testid="gacha-load-catalog" type="button" :disabled="!canLoadGachaCatalog" @click="loadGachaCatalog()">
            {{ gachaLoading ? 'Loading' : 'Load Catalog' }}
          </button>
        </section>

        <section v-if="gachaCatalog" class="panel support-admin-panel support-admin-plan" data-testid="gacha-season-plan">
          <header class="support-admin-section-header">
            <div>
              <h3>Season Plan</h3>
              <p>{{ gachaSelectedPlanItems.length }} images · {{ gachaPlanTotalWeight }} total weight</p>
            </div>
            <label class="support-admin-compact-label support-admin-plan-season">
              <span>Season</span>
              <select class="support-admin-input" data-testid="gacha-plan-season" v-model="gachaPlanForm.seasonId">
                <option value="">Select season</option>
                <option v-for="season in gachaSeasons" :key="season.id" :value="season.id">{{ localizedName(season.name) || season.id }}</option>
              </select>
            </label>
          </header>

          <div class="support-admin-plan-coverage" data-testid="gacha-plan-coverage">
            <article v-for="character in gachaPlanCoverage" :key="character.id" class="support-admin-plan-character" :class="{ 'support-admin-plan-character--ready': character.enough }">
              <strong>{{ character.label }}</strong>
              <span>{{ character.count }} / {{ character.target }}</span>
              <small>{{ character.enough ? 'enough' : character.missing + ' missing' }}</small>
            </article>
          </div>

          <section class="support-admin-plan-upload" data-testid="gacha-plan-upload-form">
            <label>
              <span>Images</span>
              <input ref="gachaPlanFileInput" class="support-admin-input" data-testid="gacha-plan-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleGachaPlanFiles" />
            </label>
            <label>
              <span>Character</span>
              <select class="support-admin-input" data-testid="gacha-plan-character" v-model="gachaPlanForm.characterId">
                <option v-for="character in gachaPlanCharacters" :key="character.id" :value="character.id">{{ character.label }}</option>
              </select>
            </label>
            <label>
              <span>Rarity</span>
              <select class="support-admin-input" data-testid="gacha-plan-rarity" v-model="gachaPlanForm.rarity">
                <option value="common">common</option>
                <option value="rare">rare</option>
                <option value="epic">epic</option>
                <option value="legendary">legendary</option>
                <option value="secret">secret</option>
              </select>
            </label>
            <label>
              <span>Chance Weight</span>
              <input class="support-admin-input" data-testid="gacha-plan-weight" type="number" min="1" step="1" v-model.number="gachaPlanForm.dropWeight" />
            </label>
            <button class="primary support-admin-submit" data-testid="gacha-plan-upload" type="button" :disabled="!canUploadGachaPlanItems" @click="uploadGachaPlanImages">
              {{ gachaActionLoading ? 'Uploading' : 'Upload' }}
            </button>
          </section>

          <section class="support-admin-plan-promote" data-testid="gacha-plan-promote-form">
            <div>
              <strong>{{ gachaPlanReadyItems.length }}</strong>
              <span>ready images</span>
            </div>
            <label>
              <span>Target Pack</span>
              <select class="support-admin-input" data-testid="gacha-plan-promote-pack" v-model="gachaPlanForm.promotePackId">
                <option value="">Select pack</option>
                <option v-for="pack in gachaPlanPacks" :key="pack.id" :value="pack.id">{{ localizedName(pack.name) || pack.id }} · {{ pack.reviewStatus }}</option>
              </select>
            </label>
            <button class="support-admin-secondary-button" data-testid="gacha-plan-promote" type="button" :disabled="!canPromoteGachaPlanItems" @click="promoteGachaPlanItems">
              {{ gachaActionLoading ? 'Adding' : 'Add Ready To Pack' }}
            </button>
          </section>

          <div class="support-admin-plan-grid" data-testid="gacha-plan-items">
            <article v-for="item in gachaSelectedPlanItems" :key="item.id" class="support-admin-plan-item">
              <img :src="item.imagePath" :alt="item.assetId" data-testid="gacha-plan-thumb" />
              <div class="support-admin-plan-item-fields">
                <strong>{{ gachaPlanCharacterLabel(item.characterId) }}</strong>
                <small>{{ item.assetId }}</small>
                <div class="support-admin-plan-edit-row">
                  <label>
                    <span>Character</span>
                    <select class="support-admin-input" data-testid="gacha-plan-item-character" v-model="item.characterId">
                      <option v-for="character in gachaPlanCharacters" :key="character.id" :value="character.id">{{ character.label }}</option>
                    </select>
                  </label>
                  <label>
                    <span>Rarity</span>
                    <select class="support-admin-input" data-testid="gacha-plan-item-rarity" v-model="item.rarity">
                      <option value="common">common</option>
                      <option value="rare">rare</option>
                      <option value="epic">epic</option>
                      <option value="legendary">legendary</option>
                      <option value="secret">secret</option>
                    </select>
                  </label>
                  <label>
                    <span>Weight</span>
                    <input class="support-admin-input" data-testid="gacha-plan-item-weight" type="number" min="1" step="1" v-model.number="item.dropWeight" />
                  </label>
                  <label>
                    <span>Status</span>
                    <select class="support-admin-input" data-testid="gacha-plan-item-status" v-model="item.status">
                      <option value="planned">planned</option>
                      <option value="ready">ready</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </label>
                </div>
                <div class="support-admin-plan-item-actions">
                  <span data-testid="gacha-plan-item-chance">{{ formatGachaPlanChance(item) }}</span>
                  <button class="support-admin-secondary-button" type="button" data-testid="gacha-plan-item-save" :disabled="gachaActionLoading" @click="updateGachaPlanItem(item)">Save</button>
                  <button class="support-admin-mini-button" type="button" data-testid="gacha-plan-item-delete" :disabled="gachaActionLoading" @click="deleteGachaPlanItem(item)">Remove</button>
                </div>
              </div>
            </article>
            <p v-if="!gachaSelectedPlanItems.length" class="support-admin-balance">No images in this season plan.</p>
          </div>
        </section>

        <details v-if="gachaCatalog" class="panel support-admin-panel support-admin-advanced" data-testid="gacha-advanced-tools" :open="gachaAdvancedOpen" @toggle="gachaAdvancedOpen = $event.target.open">
          <summary>Advanced Catalog Tools</summary>

        <section class="support-admin-panel support-admin-panel--flat" data-testid="gacha-catalog">
          <h3>Gacha Catalog</h3>
          <dl class="support-admin-metrics support-admin-metrics--gacha">
            <div><dt>Seasons</dt><dd>{{ gachaSeasons.length }}</dd></div>
            <div><dt>Collections</dt><dd>{{ gachaCollections.length }}</dd></div>
            <div><dt>Packs</dt><dd>{{ gachaPacks.length }}</dd></div>
            <div><dt>Assets</dt><dd>{{ gachaAssetOptions.length }}</dd></div>
          </dl>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table support-admin-gacha-table" data-testid="gacha-packs-table">
              <thead>
                <tr><th>Pack</th><th>Status</th><th>Review</th><th>Items</th><th>Price</th><th>Release</th><th>Action</th></tr>
              </thead>
              <tbody>
                <tr v-for="pack in gachaPacks" :key="pack.id" :data-pack-id="pack.id" :class="{ active: gachaForm.packId === pack.id }">
                  <td><strong>{{ localizedName(pack.name) || pack.id }}</strong><small>{{ pack.id }}</small></td>
                  <td>{{ pack.status }}</td>
                  <td>{{ pack.reviewStatus }}</td>
                  <td>{{ pack.itemCount || 0 }}</td>
                  <td>{{ pack.rollPriceAmount }} {{ pack.rollPriceCurrencyCode }}</td>
                  <td>
                    <span class="support-admin-badge" :class="pack.releaseChecklist?.ok ? 'support-admin-badge--ok' : 'support-admin-badge--warn'">
                      {{ pack.releaseChecklist?.ok ? 'ready' : 'blocked' }}
                    </span>
                    <small v-if="pack.releaseChecklist?.blockers?.length">{{ pack.releaseChecklist.blockers.length }} blockers</small>
                  </td>
                  <td><button class="support-admin-mini-button" type="button" data-testid="gacha-select-pack" @click="fillGachaPack(pack)">Edit</button></td>
                </tr>
                <tr v-if="!gachaPacks.length"><td colspan="7">No database gacha packs yet.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="support-admin-panel support-admin-panel--flat support-admin-action-form" data-testid="gacha-fixture-panel">
          <h3>Fixture Import / Export</h3>
          <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-fixture-json" rows="6" v-model="gachaFixtureJson"></textarea>
          <div class="support-admin-gacha-actions support-admin-fixture-actions">
            <label class="support-admin-checkline">
              <input type="checkbox" data-testid="gacha-fixture-dry-run-toggle" v-model="gachaFixtureDryRun" />
              <span>Dry run</span>
            </label>
            <label class="support-admin-checkline">
              <input type="checkbox" data-testid="gacha-fixture-allow-approved" v-model="gachaFixtureAllowApproved" />
              <span>Preserve approved packs</span>
            </label>
            <button class="support-admin-secondary-button" data-testid="gacha-fixture-export" type="button" :disabled="gachaActionLoading" @click="exportGachaFixture">Export</button>
            <button class="support-admin-secondary-button" data-testid="gacha-fixture-dry-run" type="button" :disabled="!canRunGachaFixtureImport" @click="importGachaFixture({ dryRun: true })">Dry Run</button>
            <button class="primary support-admin-submit" data-testid="gacha-fixture-import" type="button" :disabled="!canRunGachaFixtureImport" @click="importGachaFixture({ dryRun: false })">Import</button>
          </div>
          <section v-if="gachaFixtureResult" class="support-admin-fixture-result" data-testid="gacha-fixture-result">
            <p class="support-admin-balance">
              Result:
              <strong>{{ gachaFixtureResult.dryRun ? 'dry run' : 'applied' }}</strong>
              · {{ gachaFixtureSummary?.total || 0 }} operations
            </p>
            <div class="support-admin-table-wrap">
              <table class="support-admin-table support-admin-compact-table">
                <thead><tr><th>Type</th><th>ID</th><th>Action</th><th>Items</th></tr></thead>
                <tbody>
                  <tr v-for="operation in gachaFixtureOperations" :key="operation.type + operation.id + operation.action">
                    <td>{{ operation.type }}</td>
                    <td>{{ operation.id }}</td>
                    <td>{{ operation.action }}</td>
                    <td>{{ operation.afterCountText }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <datalist id="gacha-asset-options">
          <option v-for="asset in gachaAssetOptions" :key="asset.assetId" :value="asset.assetId">{{ gachaAssetLabel(asset) }}</option>
        </datalist>

        <div class="support-admin-columns support-admin-gacha-columns">
          <section class="support-admin-panel support-admin-panel--flat support-admin-action-form" data-testid="gacha-season-form">
            <h3>Season</h3>
            <label>
              <span>Existing</span>
              <select class="support-admin-input" data-testid="gacha-season-existing" @change="selectGachaSeasonById($event.target.value)">
                <option value="">Select season</option>
                <option v-for="season in gachaSeasons" :key="season.id" :value="season.id">{{ gachaSeasonLabel(season) }}</option>
              </select>
            </label>
            <label>
              <span>ID</span>
              <input class="support-admin-input" data-testid="gacha-season-id" v-model="gachaForm.seasonId" />
            </label>
            <label>
              <span>Name</span>
              <input class="support-admin-input" data-testid="gacha-season-name" v-model="gachaForm.seasonName" />
            </label>
            <label>
              <span>Status</span>
              <select class="support-admin-input" data-testid="gacha-season-status" v-model="gachaForm.seasonStatus">
                <option value="draft">draft</option>
                <option value="future">future</option>
                <option value="active">active</option>
                <option value="expired">expired</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <div class="support-admin-inline-fields">
              <label>
                <span>Starts</span>
                <input class="support-admin-input" data-testid="gacha-season-starts" v-model="gachaForm.seasonStartsAt" placeholder="2026-08-01T00:00:00Z" />
              </label>
              <label>
                <span>Ends</span>
                <input class="support-admin-input" data-testid="gacha-season-ends" v-model="gachaForm.seasonEndsAt" placeholder="2026-09-01T00:00:00Z" />
              </label>
            </div>
            <button class="primary support-admin-submit" data-testid="gacha-save-season" type="button" :disabled="!canSubmitGachaSeason" @click="submitGachaSeason">
              {{ gachaActionLoading ? 'Saving' : 'Save Season' }}
            </button>
          </section>

          <section class="support-admin-panel support-admin-panel--flat support-admin-action-form" data-testid="gacha-collection-form">
            <h3>Collection</h3>
            <label>
              <span>Existing</span>
              <select class="support-admin-input" data-testid="gacha-collection-existing" @change="selectGachaCollectionById($event.target.value)">
                <option value="">Select collection</option>
                <option v-for="collection in gachaCollections" :key="collection.id" :value="collection.id">{{ gachaCollectionLabel(collection) }}</option>
              </select>
            </label>
            <label>
              <span>ID</span>
              <input class="support-admin-input" data-testid="gacha-collection-id" v-model="gachaForm.collectionId" />
            </label>
            <label>
              <span>Name</span>
              <input class="support-admin-input" data-testid="gacha-collection-name" v-model="gachaForm.collectionName" />
            </label>
            <label>
              <span>Status</span>
              <select class="support-admin-input" data-testid="gacha-collection-status" v-model="gachaForm.collectionStatus">
                <option value="draft">draft</option>
                <option value="future">future</option>
                <option value="active">active</option>
                <option value="expired">expired</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <div class="support-admin-inline-fields">
              <label>
                <span>Starts</span>
                <input class="support-admin-input" data-testid="gacha-collection-starts" v-model="gachaForm.collectionStartsAt" />
              </label>
              <label>
                <span>Ends</span>
                <input class="support-admin-input" data-testid="gacha-collection-ends" v-model="gachaForm.collectionEndsAt" />
              </label>
            </div>
            <button class="primary support-admin-submit" data-testid="gacha-save-collection" type="button" :disabled="!canSubmitGachaCollection" @click="submitGachaCollection">
              {{ gachaActionLoading ? 'Saving' : 'Save Collection' }}
            </button>
          </section>
        </div>

        <section class="support-admin-panel support-admin-panel--flat support-admin-action-form" data-testid="gacha-pack-form">
          <h3>Pack</h3>
          <div class="support-admin-gacha-pack-grid">
            <label>
              <span>ID</span>
              <input class="support-admin-input" data-testid="gacha-pack-id" v-model="gachaForm.packId" />
            </label>
            <label>
              <span>Name</span>
              <input class="support-admin-input" data-testid="gacha-pack-name" v-model="gachaForm.packName" />
            </label>
            <label>
              <span>Season</span>
              <select class="support-admin-input" data-testid="gacha-pack-season" v-model="gachaForm.seasonId">
                <option value="">Select season</option>
                <option v-for="season in gachaSeasons" :key="season.id" :value="season.id">{{ localizedName(season.name) || season.id }}</option>
              </select>
            </label>
            <label>
              <span>Collection</span>
              <select class="support-admin-input" data-testid="gacha-pack-collection" v-model="gachaForm.collectionId">
                <option value="">Select collection</option>
                <option v-for="collection in filteredGachaCollections" :key="collection.id" :value="collection.id">{{ localizedName(collection.name) || collection.id }}</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select class="support-admin-input" data-testid="gacha-pack-status" v-model="gachaForm.packStatus">
                <option value="future">future</option>
                <option value="active">active</option>
                <option value="expired">expired</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label>
              <span>Price</span>
              <input class="support-admin-input" data-testid="gacha-pack-price" type="number" min="1" step="1" v-model.number="gachaForm.rollPriceAmount" />
            </label>
            <label>
              <span>Roll Size</span>
              <input class="support-admin-input" data-testid="gacha-pack-roll-size" type="number" min="1" max="10" step="1" v-model.number="gachaForm.rollSize" />
            </label>
            <label>
              <span>Version</span>
              <input class="support-admin-input" data-testid="gacha-pack-version" v-model="gachaForm.rarityTableVersion" />
            </label>
          </div>
          <div class="support-admin-inline-fields">
            <label>
              <span>Starts</span>
              <input class="support-admin-input" data-testid="gacha-pack-starts" v-model="gachaForm.packStartsAt" />
            </label>
            <label>
              <span>Ends</span>
              <input class="support-admin-input" data-testid="gacha-pack-ends" v-model="gachaForm.packEndsAt" />
            </label>
          </div>
          <div class="support-admin-gacha-json-grid">
            <label>
              <span>Rarity Weights JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-rarity-weights" rows="5" v-model="gachaForm.rarityWeightsJson"></textarea>
            </label>
            <label>
              <span>Slots JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-slots" rows="5" v-model="gachaForm.slotsJson"></textarea>
            </label>
            <label>
              <span>Guarantees JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-guarantees" rows="5" v-model="gachaForm.guaranteesJson"></textarea>
            </label>
            <label>
              <span>Pity JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-pity" rows="5" v-model="gachaForm.pityRulesJson"></textarea>
            </label>
            <label>
              <span>Duplicate Policy JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-duplicate-policy" rows="5" v-model="gachaForm.duplicatePolicyJson"></textarea>
            </label>
            <label>
              <span>Burn Rules JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-burn-rules" rows="5" v-model="gachaForm.burnRulesJson"></textarea>
            </label>
            <label>
              <span>Metadata JSON</span>
              <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-pack-metadata" rows="5" v-model="gachaForm.metadataJson"></textarea>
            </label>
          </div>
          <div class="support-admin-inline-fields">
            <label>
              <span>Reason</span>
              <input class="support-admin-input" data-testid="gacha-action-reason" v-model="gachaForm.reason" />
            </label>
            <label>
              <span>Note</span>
              <input class="support-admin-input" data-testid="gacha-action-note" v-model="gachaForm.note" />
            </label>
          </div>
          <div class="support-admin-gacha-actions">
            <label class="support-admin-compact-label">
              <span>Trials</span>
              <input class="support-admin-input" data-testid="gacha-preview-trials" type="number" min="100" max="100000" step="100" v-model.number="gachaSimulationTrials" />
            </label>
            <button class="primary support-admin-submit" data-testid="gacha-save-pack" type="button" :disabled="!canSubmitGachaPack" @click="submitGachaPack">
              {{ gachaActionLoading ? 'Saving' : 'Save Pack' }}
            </button>
            <button class="support-admin-secondary-button" data-testid="gacha-validate-pack" type="button" :disabled="!gachaForm.packId || gachaActionLoading" @click="validateGachaPack">Preview</button>
            <button class="support-admin-secondary-button" data-testid="gacha-publish-pack" type="button" :disabled="!gachaForm.packId || gachaActionLoading" @click="transitionGachaPack('publish')">Publish</button>
            <button class="support-admin-secondary-button" data-testid="gacha-disable-pack" type="button" :disabled="!gachaForm.packId || gachaActionLoading" @click="transitionGachaPack('disable')">Disable</button>
            <button class="support-admin-secondary-button" data-testid="gacha-expire-pack" type="button" :disabled="!gachaForm.packId || gachaActionLoading" @click="transitionGachaPack('expire')">Expire</button>
          </div>
        </section>

        <section class="support-admin-panel support-admin-panel--flat support-admin-action-form" data-testid="gacha-items-form">
          <h3>Pack Items</h3>
          <div class="support-admin-gacha-items">
            <div class="support-admin-gacha-item-row" v-for="(item, index) in gachaItemDrafts" :key="index">
              <label>
                <span>Asset</span>
                <input class="support-admin-input" data-testid="gacha-item-asset" list="gacha-asset-options" v-model="item.assetId" @change="applyGachaAssetOption(index)" />
              </label>
              <label>
                <span>Rarity</span>
                <select class="support-admin-input" data-testid="gacha-item-rarity" v-model="item.rarity">
                  <option value="common">common</option>
                  <option value="rare">rare</option>
                  <option value="epic">epic</option>
                  <option value="legendary">legendary</option>
                  <option value="secret">secret</option>
                </select>
              </label>
              <label>
                <span>Weight</span>
                <input class="support-admin-input" data-testid="gacha-item-weight" type="number" min="1" step="1" v-model.number="item.dropWeight" />
              </label>
              <label>
                <span>Copy Cap</span>
                <input class="support-admin-input" data-testid="gacha-item-copy-limit" type="number" min="1" step="1" v-model="item.copyLimit" />
              </label>
              <label>
                <span>Metadata</span>
                <textarea class="support-admin-input support-admin-code-input" data-testid="gacha-item-metadata" rows="2" v-model="item.metadataJson"></textarea>
              </label>
              <button class="support-admin-icon-button" type="button" :aria-label="'Remove item ' + (index + 1)" @click="removeGachaItemDraft(index)">X</button>
            </div>
          </div>
          <div class="support-admin-gacha-actions">
            <button class="support-admin-secondary-button" data-testid="gacha-add-item" type="button" @click="addGachaItemDraft">Add Item</button>
            <button class="primary support-admin-submit" data-testid="gacha-save-items" type="button" :disabled="!canSubmitGachaItems" @click="submitGachaItems">
              {{ gachaActionLoading ? 'Saving' : 'Save Items' }}
            </button>
          </div>
        </section>

        <section v-if="gachaValidationResult" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-validation">
          <h3>Validation</h3>
          <p class="support-admin-balance">
            Result:
            <strong>{{ gachaValidationResult.ok ? 'ok' : 'needs work' }}</strong>
          </p>
          <ul class="support-admin-gacha-issues">
            <li v-for="issue in gachaValidationIssues" :key="issue.severity + issue.code + issue.message" :class="'support-admin-gacha-issue--' + issue.severity">
              <strong>{{ issue.severity }}</strong>
              <span>{{ issue.code }} · {{ issue.message }}</span>
            </li>
            <li v-if="!gachaValidationIssues.length">No validation issues.</li>
          </ul>
        </section>

        <section v-if="gachaReleaseChecklist" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-release-checklist">
          <h3>Release Checklist</h3>
          <p class="support-admin-balance">
            Result:
            <strong>{{ gachaReleaseChecklist.ok ? 'ready' : 'blocked' }}</strong>
          </p>
          <ul class="support-admin-gacha-issues">
            <li v-for="issue in gachaReleaseItems" :key="issue.severity + issue.code" :class="'support-admin-gacha-issue--' + issue.severity">
              <strong>{{ issue.severity }}</strong>
              <span>{{ issue.code }} · {{ issue.message }}</span>
            </li>
          </ul>
        </section>

        <section v-if="gachaOddsTables.length" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-odds-preview">
          <h3>Odds Preview</h3>
          <GachaOddsTable
            :sections="gachaOddsTables"
            section-class="support-admin-table-wrap"
            table-class="support-admin-table support-admin-compact-table"
          />
        </section>

        <section v-if="gachaSimulation" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-simulation">
          <h3>Roll Simulation</h3>
          <dl class="support-admin-metrics support-admin-metrics--gacha">
            <div><dt>Trials</dt><dd>{{ gachaSimulation.trials }}</dd></div>
            <div><dt>Candidates</dt><dd>{{ gachaSimulation.candidateCount }}</dd></div>
            <div><dt>Weighted</dt><dd>{{ gachaSimulation.weightedCandidateCount }}</dd></div>
            <div><dt>Avg Items</dt><dd>{{ Number(gachaSimulation.averageItemsPerRoll || 0).toFixed(2) }}</dd></div>
          </dl>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table support-admin-compact-table">
              <thead><tr><th>Asset</th><th>Rarity</th><th>Weight</th><th>Observed / roll</th><th>Observed</th></tr></thead>
              <tbody>
                <tr v-for="item in gachaSimulationItems" :key="item.assetId">
                  <td>{{ item.assetId }}</td>
                  <td>{{ item.rarity }}</td>
                  <td>{{ item.dropWeightText }}</td>
                  <td>{{ item.observedPerRollText }}</td>
                  <td>{{ item.observedCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="gachaAssetPolicyRecommendations.length" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-policy-recommendations">
          <h3>Asset Policy Mapping</h3>
          <div class="support-admin-table-wrap">
            <table class="support-admin-table support-admin-compact-table">
              <thead><tr><th>Asset</th><th>Current</th><th>Recommended</th></tr></thead>
              <tbody>
                <tr v-for="entry in gachaAssetPolicyRecommendations" :key="entry.assetId">
                  <td>{{ entry.assetId }}</td>
                  <td>{{ compactJson(entry.current) }}</td>
                  <td>{{ compactJson(entry.recommended) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="gachaDraftDiff" class="support-admin-panel support-admin-panel--flat" data-testid="gacha-draft-diff">
          <h3>Live/Draft Diff</h3>
          <p v-if="gachaDraftDiff.missingBase" class="support-admin-balance">Base pack {{ gachaDraftDiff.basePackId }} was not found.</p>
          <p v-else-if="!gachaDraftDiffRows.length" class="support-admin-balance">No live/draft changes detected.</p>
          <div v-else class="support-admin-table-wrap">
            <table class="support-admin-table support-admin-compact-table">
              <thead><tr><th>Type</th><th>Field</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                <tr v-for="row in gachaDraftDiffRows" :key="row.type + row.field">
                  <td>{{ row.type }}</td>
                  <td>{{ row.field }}</td>
                  <td>{{ compactJson(row.before) }}</td>
                  <td>{{ compactJson(row.after) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        </details>
      </template>
    </section>
  `
};
