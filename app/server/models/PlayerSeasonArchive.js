import { DataTypes } from 'sequelize';

export default function definePlayerSeasonArchive(sequelize) {
  return sequelize.define('PlayerSeasonArchive', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    season_id: { type: DataTypes.TEXT, allowNull: false },
    final_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    final_level_id: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'bronze' },
    peak_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    peak_level_id: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'bronze' },
    reward_spore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reward_mycelium: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    archived_at: { type: DataTypes.TEXT, allowNull: false },
    reward_claimed_at: { type: DataTypes.TEXT }
  }, {
    tableName: 'player_season_archives',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['player_id', 'season_id'],
        name: 'idx_player_season_archive_once'
      }
    ]
  });
}
