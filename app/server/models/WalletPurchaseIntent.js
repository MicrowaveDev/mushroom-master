import { DataTypes } from 'sequelize';

export default function defineWalletPurchaseIntent(sequelize) {
  return sequelize.define('WalletPurchaseIntent', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    provider: { type: DataTypes.TEXT, allowNull: false },
    provider_invoice_id: { type: DataTypes.TEXT },
    provider_payment_id: { type: DataTypes.TEXT },
    currency_code: { type: DataTypes.TEXT, allowNull: false },
    wallet_amount: { type: DataTypes.INTEGER, allowNull: false },
    price_amount: { type: DataTypes.INTEGER, allowNull: false },
    price_currency: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false },
    checkout_status: { type: DataTypes.TEXT },
    checkout_claim_token: { type: DataTypes.TEXT },
    checkout_claimed_at: { type: DataTypes.TEXT },
    idempotency_key: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false },
    completed_at: { type: DataTypes.TEXT }
  }, {
    tableName: 'wallet_purchase_intents',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'status'], name: 'idx_wallet_purchase_intents_player_status' },
      { fields: ['provider', 'provider_invoice_id'], name: 'idx_wallet_purchase_intents_provider_invoice' }
    ]
  });
}
