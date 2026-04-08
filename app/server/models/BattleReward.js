import { DataTypes } from 'sequelize';

export default function defineBattleReward(sequelize) {
  return sequelize.define('BattleReward', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    battle_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'battles', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    mushroom_id: { type: DataTypes.TEXT, allowNull: false },
    spore_delta: { type: DataTypes.INTEGER, allowNull: false },
    mycelium_delta: { type: DataTypes.INTEGER, allowNull: false },
    rating_before: { type: DataTypes.INTEGER },
    rating_after: { type: DataTypes.INTEGER },
    wins_delta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    losses_delta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    draws_delta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reward_scope: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'battle_rewards',
    timestamps: false
  });
}
