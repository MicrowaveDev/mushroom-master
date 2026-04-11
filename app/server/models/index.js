import definePlayer from './Player.js';
import definePlayerSettings from './PlayerSettings.js';
import defineSession from './Session.js';
import defineAuthCode from './AuthCode.js';
import definePlayerMushroom from './PlayerMushroom.js';
import definePlayerActiveCharacter from './PlayerActiveCharacter.js';
import definePlayerArtifactLoadout from './PlayerArtifactLoadout.js';
import definePlayerArtifactLoadoutItem from './PlayerArtifactLoadoutItem.js';
import definePlayerShopState from './PlayerShopState.js';
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
import defineGameRunRefund from './GameRunRefund.js';
import defineGameRunShopState from './GameRunShopState.js';

export function initModels(sequelize) {
  const Player = definePlayer(sequelize);
  const PlayerSettings = definePlayerSettings(sequelize);
  const Session = defineSession(sequelize);
  const AuthCode = defineAuthCode(sequelize);
  const PlayerMushroom = definePlayerMushroom(sequelize);
  const PlayerActiveCharacter = definePlayerActiveCharacter(sequelize);
  const PlayerArtifactLoadout = definePlayerArtifactLoadout(sequelize);
  const PlayerArtifactLoadoutItem = definePlayerArtifactLoadoutItem(sequelize);
  const PlayerShopState = definePlayerShopState(sequelize);
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
  const GameRunRefund = defineGameRunRefund(sequelize);
  const GameRunShopState = defineGameRunShopState(sequelize);

  Player.hasOne(PlayerSettings, { foreignKey: 'player_id' });
  Player.hasMany(Session, { foreignKey: 'player_id' });
  Player.hasOne(PlayerActiveCharacter, { foreignKey: 'player_id' });
  Player.hasOne(PlayerArtifactLoadout, { foreignKey: 'player_id' });
  Player.hasOne(PlayerShopState, { foreignKey: 'player_id' });
  Player.hasMany(PlayerMushroom, { foreignKey: 'player_id' });
  Player.hasMany(BattleRequest, { foreignKey: 'player_id' });
  Player.hasMany(BattleReward, { foreignKey: 'player_id' });
  Player.hasMany(GameRunPlayer, { foreignKey: 'player_id' });

  PlayerArtifactLoadout.hasMany(PlayerArtifactLoadoutItem, { foreignKey: 'loadout_id' });
  PlayerArtifactLoadoutItem.belongsTo(PlayerArtifactLoadout, { foreignKey: 'loadout_id' });

  Battle.hasMany(BattleSnapshot, { foreignKey: 'battle_id' });
  Battle.hasMany(BattleEvent, { foreignKey: 'battle_id' });
  Battle.hasMany(BattleReward, { foreignKey: 'battle_id' });

  GameRun.hasMany(GameRunPlayer, { foreignKey: 'game_run_id' });
  GameRun.hasMany(GameRound, { foreignKey: 'game_run_id' });
  GameRunPlayer.belongsTo(GameRun, { foreignKey: 'game_run_id' });
  GameRound.belongsTo(GameRun, { foreignKey: 'game_run_id' });
  GameRound.belongsTo(Battle, { foreignKey: 'battle_id' });

  GameRun.hasMany(GameRunShopState, { foreignKey: 'game_run_id' });
  GameRun.hasMany(GameRunRefund, { foreignKey: 'game_run_id' });
  // GameRunLoadoutItem intentionally has no FK to GameRun so synthetic
  // `ghost:bot:<hash>` rows can live in the same table without a parent run.

  return {
    Player,
    PlayerSettings,
    Session,
    AuthCode,
    PlayerMushroom,
    PlayerActiveCharacter,
    PlayerArtifactLoadout,
    PlayerArtifactLoadoutItem,
    PlayerShopState,
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
    GameRunShopState
  };
}
