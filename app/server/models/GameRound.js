import { DataTypes } from 'sequelize';

export default function defineGameRound(sequelize) {
  return sequelize.define('GameRound', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    battle_id: { type: DataTypes.TEXT, references: { model: 'battles', key: 'id' }, onDelete: 'SET NULL' },
    player_id: { type: DataTypes.TEXT, references: { model: 'players', key: 'id' } },
    outcome: { type: DataTypes.TEXT },
    opponent_player_id: { type: DataTypes.TEXT },
    spore_awarded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    mycelium_awarded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rating_before: { type: DataTypes.INTEGER },
    rating_after: { type: DataTypes.INTEGER },
    coins_income: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_rounds',
    timestamps: false
  });
}
