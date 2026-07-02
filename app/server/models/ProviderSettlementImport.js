import { DataTypes } from 'sequelize';

export default function defineProviderSettlementImport(sequelize) {
  return sequelize.define('ProviderSettlementImport', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    provider: { type: DataTypes.TEXT, allowNull: false },
    source_type: { type: DataTypes.TEXT, allowNull: false },
    source_ref: { type: DataTypes.TEXT },
    imported_by: { type: DataTypes.TEXT },
    record_count: { type: DataTypes.INTEGER, allowNull: false },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'provider_settlement_imports',
    timestamps: false,
    indexes: [
      { fields: ['provider', 'created_at'], name: 'idx_provider_settlement_imports_provider_time' }
    ]
  });
}
