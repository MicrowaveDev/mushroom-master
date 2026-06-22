import { DataTypes } from 'sequelize';

export default function definePlayerWalletTransaction(sequelize) {
  return sequelize.define('PlayerWalletTransaction', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    currency_code: { type: DataTypes.TEXT, allowNull: false },
    delta: { type: DataTypes.INTEGER, allowNull: false },
    balance_after: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    source_type: { type: DataTypes.TEXT },
    source_id: { type: DataTypes.TEXT },
    idempotency_key: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_wallet_transactions',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'currency_code', 'created_at'], name: 'idx_wallet_transactions_player_currency_time' }
    ]
  });
}
