import { DataTypes } from 'sequelize';

export default function definePlayerAssetInstance(sequelize) {
  return sequelize.define('PlayerAssetInstance', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    asset_id: { type: DataTypes.TEXT, allowNull: false },
    acquisition_source: { type: DataTypes.TEXT, allowNull: false },
    acquisition_source_id: { type: DataTypes.TEXT },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'active' },
    acquired_at: { type: DataTypes.TEXT, allowNull: false },
    metadata_json: { type: DataTypes.TEXT }
  }, {
    tableName: 'player_asset_instances',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'asset_id'], name: 'idx_player_asset_instances_player_asset' }
    ]
  });
}
