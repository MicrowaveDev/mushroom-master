import { DataTypes } from 'sequelize';

export default function defineAssetGachaSeason(sequelize) {
  return sequelize.define('AssetGachaSeason', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    name_json: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'draft' },
    starts_at: { type: DataTypes.TEXT },
    ends_at: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_gacha_seasons',
    timestamps: false,
    indexes: [
      { fields: ['status', 'starts_at', 'ends_at'], name: 'idx_asset_gacha_seasons_status_window' }
    ]
  });
}
