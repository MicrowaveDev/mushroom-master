import { DataTypes } from 'sequelize';

export default function definePlayerShopState(sequelize) {
  return sequelize.define('PlayerShopState', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    payload_json: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_shop_state',
    timestamps: false
  });
}
