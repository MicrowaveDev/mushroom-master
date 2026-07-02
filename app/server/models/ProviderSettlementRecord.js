import { DataTypes } from 'sequelize';

export default function defineProviderSettlementRecord(sequelize) {
  return sequelize.define('ProviderSettlementRecord', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    import_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'provider_settlement_imports', key: 'id' },
      onDelete: 'CASCADE'
    },
    provider: { type: DataTypes.TEXT, allowNull: false },
    local_intent_id: { type: DataTypes.TEXT },
    provider_invoice_id: { type: DataTypes.TEXT },
    provider_payment_id: { type: DataTypes.TEXT },
    settlement_status: { type: DataTypes.TEXT, allowNull: false },
    price_amount: { type: DataTypes.INTEGER },
    price_currency: { type: DataTypes.TEXT },
    settled_at: { type: DataTypes.TEXT },
    raw_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'provider_settlement_records',
    timestamps: false,
    indexes: [
      { fields: ['import_id'], name: 'idx_provider_settlement_records_import' },
      { fields: ['provider', 'local_intent_id'], name: 'idx_provider_settlement_records_local_intent' },
      { fields: ['provider', 'provider_invoice_id'], name: 'idx_provider_settlement_records_invoice' },
      { fields: ['provider', 'provider_payment_id'], name: 'idx_provider_settlement_records_payment' },
      { fields: ['provider', 'settlement_status'], name: 'idx_provider_settlement_records_status' }
    ]
  });
}
