import { DataTypes } from 'sequelize';

export default function definePlayerSeasonProgress(sequelize) {
  return sequelize.define('PlayerSeasonProgress', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    season_id: { type: DataTypes.TEXT, primaryKey: true },
    total_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    level_id: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'bronze' },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_season_progress',
    timestamps: false
  });
}
