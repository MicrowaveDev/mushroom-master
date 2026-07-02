import { DataTypes } from 'sequelize';

export default function defineAssetGachaCollection(sequelize) {
  return sequelize.define('AssetGachaCollection', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    season_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'asset_gacha_seasons', key: 'id' },
      onDelete: 'CASCADE'
    },
    name_json: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'draft' },
    starts_at: { type: DataTypes.TEXT },
    ends_at: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_gacha_collections',
    timestamps: false,
    indexes: [
      { fields: ['season_id', 'status'], name: 'idx_asset_gacha_collections_season_status' }
    ]
  });
}
