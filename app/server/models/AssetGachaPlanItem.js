import { DataTypes } from 'sequelize';

export default function defineAssetGachaPlanItem(sequelize) {
  return sequelize.define('AssetGachaPlanItem', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    season_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'asset_gacha_seasons', key: 'id' },
      onDelete: 'CASCADE'
    },
    character_id: { type: DataTypes.TEXT, allowNull: false },
    asset_id: { type: DataTypes.TEXT, allowNull: false },
    image_path: { type: DataTypes.TEXT, allowNull: false },
    file_name: { type: DataTypes.TEXT },
    mime_type: { type: DataTypes.TEXT, allowNull: false },
    rarity: { type: DataTypes.TEXT, allowNull: false },
    drop_weight: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'planned' },
    metadata_json: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_gacha_plan_items',
    timestamps: false,
    indexes: [
      { fields: ['season_id', 'character_id'], name: 'idx_asset_gacha_plan_items_season_character' },
      { fields: ['season_id', 'status'], name: 'idx_asset_gacha_plan_items_season_status' },
      { fields: ['asset_id'], name: 'idx_asset_gacha_plan_items_asset' }
    ]
  });
}
