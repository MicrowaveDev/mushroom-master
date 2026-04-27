import { DataTypes } from 'sequelize';

export default function definePlayerSeasonRun(sequelize) {
  return sequelize.define('PlayerSeasonRun', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    season_id: { type: DataTypes.TEXT, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    level_id: { type: DataTypes.TEXT, allowNull: false },
    wins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    losses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completed_rounds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    end_reason: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_season_runs',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['player_id', 'game_run_id'],
        name: 'idx_player_season_runs_once_per_run'
      }
    ]
  });
}
