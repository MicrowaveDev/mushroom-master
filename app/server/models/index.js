// Legacy single-battle models (PlayerArtifactLoadout, PlayerArtifactLoadoutItem,
// PlayerShopState) deleted 2026-04-13. Their tables stay in the database for
// existing dev/prod schemas but are no longer registered with Sequelize, so
// no code path in the server reads or writes them. They can be dropped in a
// follow-up DB migration if storage matters.

import definePlayer from './Player.js';
import definePlayerSettings from './PlayerSettings.js';
import defineSession from './Session.js';
import defineAuthCode from './AuthCode.js';
import definePlayerMushroom from './PlayerMushroom.js';
import definePlayerActiveCharacter from './PlayerActiveCharacter.js';
import defineFriendship from './Friendship.js';
import defineFriendChallenge from './FriendChallenge.js';
import defineBattleRequest from './BattleRequest.js';
import defineDailyRateLimit from './DailyRateLimit.js';
import defineBattle from './Battle.js';
import defineBattleSnapshot from './BattleSnapshot.js';
import defineBattleEvent from './BattleEvent.js';
import defineBattleReward from './BattleReward.js';
import defineLocalTestRun from './LocalTestRun.js';
import defineGameRun from './GameRun.js';
import defineGameRunPlayer from './GameRunPlayer.js';
import defineGameRound from './GameRound.js';
import defineGameRunLoadoutItem from './GameRunLoadoutItem.js';
import defineGameRunFusion from './GameRunFusion.js';
import defineGameRunRefund from './GameRunRefund.js';
import defineGameRunShopState from './GameRunShopState.js';
import definePlayerSeasonProgress from './PlayerSeasonProgress.js';
import definePlayerSeasonRun from './PlayerSeasonRun.js';
import definePlayerAchievement from './PlayerAchievement.js';
import defineClientEvent from './ClientEvent.js';
import definePlayerSeasonArchive from './PlayerSeasonArchive.js';
import definePlayerWalletBalance from './PlayerWalletBalance.js';
import definePlayerWalletTransaction from './PlayerWalletTransaction.js';
import defineWalletPurchaseIntent from './WalletPurchaseIntent.js';
import definePlayerAssetInstance from './PlayerAssetInstance.js';
import definePlayerEquippedAsset from './PlayerEquippedAsset.js';
import defineAssetRoll from './AssetRoll.js';
import defineAssetBurnExchange from './AssetBurnExchange.js';
import defineAssetGachaSeason from './AssetGachaSeason.js';
import defineAssetGachaCollection from './AssetGachaCollection.js';
import defineAssetGachaPack from './AssetGachaPack.js';
import defineAssetGachaPackItem from './AssetGachaPackItem.js';
import defineAssetGachaPlanItem from './AssetGachaPlanItem.js';
import defineMutationClaim from './MutationClaim.js';
import definePaymentWebhookEvent from './PaymentWebhookEvent.js';
import defineProviderSettlementImport from './ProviderSettlementImport.js';
import defineProviderSettlementRecord from './ProviderSettlementRecord.js';
import defineSupportAction from './SupportAction.js';

export function initModels(sequelize) {
  const Player = definePlayer(sequelize);
  const PlayerSettings = definePlayerSettings(sequelize);
  const Session = defineSession(sequelize);
  const AuthCode = defineAuthCode(sequelize);
  const PlayerMushroom = definePlayerMushroom(sequelize);
  const PlayerActiveCharacter = definePlayerActiveCharacter(sequelize);
  const Friendship = defineFriendship(sequelize);
  const FriendChallenge = defineFriendChallenge(sequelize);
  const BattleRequest = defineBattleRequest(sequelize);
  const DailyRateLimit = defineDailyRateLimit(sequelize);
  const Battle = defineBattle(sequelize);
  const BattleSnapshot = defineBattleSnapshot(sequelize);
  const BattleEvent = defineBattleEvent(sequelize);
  const BattleReward = defineBattleReward(sequelize);
  const LocalTestRun = defineLocalTestRun(sequelize);
  const GameRun = defineGameRun(sequelize);
  const GameRunPlayer = defineGameRunPlayer(sequelize);
  const GameRound = defineGameRound(sequelize);
  const GameRunLoadoutItem = defineGameRunLoadoutItem(sequelize);
  const GameRunFusion = defineGameRunFusion(sequelize);
  const GameRunRefund = defineGameRunRefund(sequelize);
  const GameRunShopState = defineGameRunShopState(sequelize);
  const PlayerSeasonProgress = definePlayerSeasonProgress(sequelize);
  const PlayerSeasonRun = definePlayerSeasonRun(sequelize);
  const PlayerAchievement = definePlayerAchievement(sequelize);
  const ClientEvent = defineClientEvent(sequelize);
  const PlayerSeasonArchive = definePlayerSeasonArchive(sequelize);
  const PlayerWalletBalance = definePlayerWalletBalance(sequelize);
  const PlayerWalletTransaction = definePlayerWalletTransaction(sequelize);
  const WalletPurchaseIntent = defineWalletPurchaseIntent(sequelize);
  const PlayerAssetInstance = definePlayerAssetInstance(sequelize);
  const PlayerEquippedAsset = definePlayerEquippedAsset(sequelize);
  const AssetRoll = defineAssetRoll(sequelize);
  const AssetBurnExchange = defineAssetBurnExchange(sequelize);
  const AssetGachaSeason = defineAssetGachaSeason(sequelize);
  const AssetGachaCollection = defineAssetGachaCollection(sequelize);
  const AssetGachaPack = defineAssetGachaPack(sequelize);
  const AssetGachaPackItem = defineAssetGachaPackItem(sequelize);
  const AssetGachaPlanItem = defineAssetGachaPlanItem(sequelize);
  const MutationClaim = defineMutationClaim(sequelize);
  const PaymentWebhookEvent = definePaymentWebhookEvent(sequelize);
  const ProviderSettlementImport = defineProviderSettlementImport(sequelize);
  const ProviderSettlementRecord = defineProviderSettlementRecord(sequelize);
  const SupportAction = defineSupportAction(sequelize);

  Player.hasOne(PlayerSettings, { foreignKey: 'player_id' });
  Player.hasMany(Session, { foreignKey: 'player_id' });
  Player.hasOne(PlayerActiveCharacter, { foreignKey: 'player_id' });
  Player.hasMany(PlayerMushroom, { foreignKey: 'player_id' });
  Player.hasMany(BattleRequest, { foreignKey: 'player_id' });
  Player.hasMany(BattleReward, { foreignKey: 'player_id' });
  Player.hasMany(GameRunPlayer, { foreignKey: 'player_id' });
  Player.hasMany(PlayerSeasonProgress, { foreignKey: 'player_id' });
  Player.hasMany(PlayerSeasonRun, { foreignKey: 'player_id' });
  Player.hasMany(PlayerAchievement, { foreignKey: 'player_id' });
  Player.hasMany(ClientEvent, { foreignKey: 'player_id' });
  Player.hasMany(PlayerSeasonArchive, { foreignKey: 'player_id' });
  Player.hasMany(PlayerWalletBalance, { foreignKey: 'player_id' });
  Player.hasMany(PlayerWalletTransaction, { foreignKey: 'player_id' });
  Player.hasMany(WalletPurchaseIntent, { foreignKey: 'player_id' });
  Player.hasMany(PlayerAssetInstance, { foreignKey: 'player_id' });
  Player.hasMany(PlayerEquippedAsset, { foreignKey: 'player_id' });
  Player.hasMany(AssetRoll, { foreignKey: 'player_id' });
  Player.hasMany(AssetBurnExchange, { foreignKey: 'player_id' });
  ProviderSettlementImport.hasMany(ProviderSettlementRecord, { foreignKey: 'import_id' });

  AssetGachaSeason.hasMany(AssetGachaCollection, { foreignKey: 'season_id' });
  AssetGachaSeason.hasMany(AssetGachaPack, { foreignKey: 'season_id' });
  AssetGachaCollection.belongsTo(AssetGachaSeason, { foreignKey: 'season_id' });
  AssetGachaCollection.hasMany(AssetGachaPack, { foreignKey: 'collection_id' });
  AssetGachaPack.belongsTo(AssetGachaSeason, { foreignKey: 'season_id' });
  AssetGachaPack.belongsTo(AssetGachaCollection, { foreignKey: 'collection_id' });
  AssetGachaPack.hasMany(AssetGachaPackItem, { foreignKey: 'pack_id' });
  AssetGachaPackItem.belongsTo(AssetGachaPack, { foreignKey: 'pack_id' });
  AssetGachaSeason.hasMany(AssetGachaPlanItem, { foreignKey: 'season_id' });
  AssetGachaPlanItem.belongsTo(AssetGachaSeason, { foreignKey: 'season_id' });

  Battle.hasMany(BattleSnapshot, { foreignKey: 'battle_id' });
  Battle.hasMany(BattleEvent, { foreignKey: 'battle_id' });
  Battle.hasMany(BattleReward, { foreignKey: 'battle_id' });

  GameRun.hasMany(GameRunPlayer, { foreignKey: 'game_run_id' });
  GameRun.hasMany(GameRound, { foreignKey: 'game_run_id' });
  GameRunPlayer.belongsTo(GameRun, { foreignKey: 'game_run_id' });
  GameRound.belongsTo(GameRun, { foreignKey: 'game_run_id' });
  GameRound.belongsTo(Battle, { foreignKey: 'battle_id' });

  GameRun.hasMany(GameRunShopState, { foreignKey: 'game_run_id' });
  GameRun.hasMany(GameRunFusion, { foreignKey: 'game_run_id' });
  GameRun.hasMany(GameRunRefund, { foreignKey: 'game_run_id' });
  GameRun.hasMany(PlayerSeasonRun, { foreignKey: 'game_run_id' });
  // GameRunLoadoutItem intentionally has no FK to GameRun so synthetic
  // `ghost:bot:<hash>` rows can live in the same table without a parent run.

  return {
    Player,
    PlayerSettings,
    Session,
    AuthCode,
    PlayerMushroom,
    PlayerActiveCharacter,
    Friendship,
    FriendChallenge,
    BattleRequest,
    DailyRateLimit,
    Battle,
    BattleSnapshot,
    BattleEvent,
    BattleReward,
    LocalTestRun,
    GameRun,
    GameRunPlayer,
    GameRound,
    GameRunLoadoutItem,
    GameRunRefund,
    GameRunShopState,
    PlayerSeasonProgress,
    PlayerSeasonRun,
    PlayerAchievement,
    ClientEvent,
    PlayerSeasonArchive,
    PlayerWalletBalance,
    PlayerWalletTransaction,
    WalletPurchaseIntent,
    PlayerAssetInstance,
    PlayerEquippedAsset,
    AssetRoll,
    AssetBurnExchange,
    AssetGachaSeason,
    AssetGachaCollection,
    AssetGachaPack,
    AssetGachaPackItem,
    AssetGachaPlanItem,
    MutationClaim,
    PaymentWebhookEvent,
    ProviderSettlementImport,
    ProviderSettlementRecord,
    SupportAction
  };
}
