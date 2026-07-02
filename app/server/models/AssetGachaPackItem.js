import { DataTypes } from 'sequelize';

export default function defineAssetGachaPackItem(sequelize) {
  return sequelize.define('AssetGachaPackItem', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    pack_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'asset_gacha_packs', key: 'id' },
      onDelete: 'CASCADE'
    },
    asset_id: { type: DataTypes.TEXT, allowNull: false },
    rarity: { type: DataTypes.TEXT, allowNull: false },
    drop_weight: { type: DataTypes.INTEGER, allowNull: false },
    copy_limit: { type: DataTypes.INTEGER },
    item_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_gacha_pack_items',
    timestamps: false,
    indexes: [
      { fields: ['pack_id', 'item_order'], name: 'idx_asset_gacha_pack_items_pack_order' },
      { fields: ['pack_id', 'asset_id'], name: 'idx_asset_gacha_pack_items_pack_asset' }
    ]
  });
}
