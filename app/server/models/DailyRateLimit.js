import { DataTypes } from 'sequelize';

export default function defineDailyRateLimit(sequelize) {
  return sequelize.define('DailyRateLimit', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    day_key: { type: DataTypes.TEXT, primaryKey: true },
    battle_starts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    tableName: 'daily_rate_limits',
    timestamps: false
  });
}
