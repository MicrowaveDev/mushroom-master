import { DataTypes } from 'sequelize';

export default function defineGameRunShopState(sequelize) {
  return sequelize.define('GameRunShopState', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    refresh_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rounds_since_bag: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    offer_json: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_run_shop_states',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['game_run_id', 'player_id'] }
    ]
  });
}
