import { DataTypes } from 'sequelize';

export default function defineGameRun(sequelize) {
  return sequelize.define('GameRun', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    mode: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'active' },
    current_round: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    started_at: { type: DataTypes.TEXT, allowNull: false },
    ended_at: { type: DataTypes.TEXT },
    end_reason: { type: DataTypes.TEXT }
  }, {
    tableName: 'game_runs',
    timestamps: false
  });
}
