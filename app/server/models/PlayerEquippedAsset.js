import { DataTypes } from 'sequelize';

export default function definePlayerEquippedAsset(sequelize) {
  return sequelize.define('PlayerEquippedAsset', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    slot: { type: DataTypes.TEXT, allowNull: false },
    target_type: { type: DataTypes.TEXT, allowNull: false },
    target_id: { type: DataTypes.TEXT },
    asset_instance_id: { type: DataTypes.TEXT },
    asset_id: { type: DataTypes.TEXT, allowNull: false },
    equipped_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_equipped_assets',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'slot', 'target_type', 'target_id'], name: 'idx_player_equipped_assets_target' }
    ]
  });
}
