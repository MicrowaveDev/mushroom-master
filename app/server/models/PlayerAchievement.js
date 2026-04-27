import { DataTypes } from 'sequelize';

export default function definePlayerAchievement(sequelize) {
  return sequelize.define('PlayerAchievement', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    achievement_id: { type: DataTypes.TEXT, allowNull: false },
    source_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'run' },
    source_id: { type: DataTypes.TEXT },
    season_id: { type: DataTypes.TEXT },
    earned_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_achievements',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['player_id', 'achievement_id'],
        name: 'idx_player_achievements_unique'
      }
    ]
  });
}
