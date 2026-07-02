import { DataTypes } from 'sequelize';

export default function defineAssetBurnExchange(sequelize) {
  return sequelize.define('AssetBurnExchange', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    pack_id: { type: DataTypes.TEXT, allowNull: false },
    rule_id: { type: DataTypes.TEXT, allowNull: false },
    source_asset_instance_ids_json: { type: DataTypes.TEXT, allowNull: false },
    result_asset_ids_json: { type: DataTypes.TEXT, allowNull: false },
    result_instance_ids_json: { type: DataTypes.TEXT, allowNull: false },
    idempotency_key: { type: DataTypes.TEXT },
    metadata_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'asset_burn_exchanges',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'pack_id', 'created_at'], name: 'idx_asset_burn_exchanges_player_pack_time' }
    ]
  });
}
