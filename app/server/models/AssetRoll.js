import { DataTypes } from 'sequelize';

export default function defineAssetRoll(sequelize) {
  return sequelize.define('AssetRoll', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    pack_id: { type: DataTypes.TEXT, allowNull: false },
    currency_code: { type: DataTypes.TEXT, allowNull: false },
    price_amount: { type: DataTypes.INTEGER, allowNull: false },
    result_asset_ids_json: { type: DataTypes.TEXT, allowNull: false },
    guarantee_state_json: { type: DataTypes.TEXT },
    candidate_pool_hash: { type: DataTypes.TEXT },
    selected_asset_id: { type: DataTypes.TEXT },
    result_instance_id: { type: DataTypes.TEXT },
    idempotency_key: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_rolls',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'pack_id', 'created_at'], name: 'idx_asset_rolls_player_pack_time' }
    ]
  });
}
