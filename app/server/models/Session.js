import { DataTypes } from 'sequelize';

export default function defineSession(sequelize) {
  return sequelize.define('Session', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    session_key: { type: DataTypes.TEXT, unique: true, allowNull: false },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    provider: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    expires_at: { type: DataTypes.TEXT, allowNull: false },
    last_seen_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'sessions',
    timestamps: false
  });
}
