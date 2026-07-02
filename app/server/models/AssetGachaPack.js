import { DataTypes } from 'sequelize';

export default function defineAssetGachaPack(sequelize) {
  return sequelize.define('AssetGachaPack', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    season_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'asset_gacha_seasons', key: 'id' },
      onDelete: 'CASCADE'
    },
    collection_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'asset_gacha_collections', key: 'id' },
      onDelete: 'CASCADE'
    },
    name_json: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'disabled' },
    review_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'draft' },
    starts_at: { type: DataTypes.TEXT },
    ends_at: { type: DataTypes.TEXT },
    roll_price_currency_code: { type: DataTypes.TEXT, allowNull: false },
    roll_price_amount: { type: DataTypes.INTEGER, allowNull: false },
    roll_size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    rarity_table_version: { type: DataTypes.TEXT },
    rarity_weights_json: { type: DataTypes.TEXT },
    slots_json: { type: DataTypes.TEXT },
    guarantees_json: { type: DataTypes.TEXT },
    pity_rules_json: { type: DataTypes.TEXT },
    duplicate_policy_json: { type: DataTypes.TEXT },
    burn_rules_json: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_by: { type: DataTypes.TEXT },
    reviewed_by: { type: DataTypes.TEXT },
    reviewed_at: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_gacha_packs',
    timestamps: false,
    indexes: [
      { fields: ['season_id', 'collection_id'], name: 'idx_asset_gacha_packs_season_collection' },
      { fields: ['review_status', 'status'], name: 'idx_asset_gacha_packs_review_status' }
    ]
  });
}
