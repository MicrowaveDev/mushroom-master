import { DataTypes } from 'sequelize';

export default function defineBattleRequest(sequelize) {
  return sequelize.define('BattleRequest', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    idempotency_key: { type: DataTypes.TEXT, allowNull: false },
    battle_id: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'battle_requests',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['player_id', 'idempotency_key'] }
    ]
  });
}
