import { DataTypes } from 'sequelize';

export default function defineGameRunLoadoutItem(sequelize) {
  return sequelize.define('GameRunLoadoutItem', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: {
      type: DataTypes.TEXT,
      allowNull: false
      // No FK to game_runs so synthetic ghost:bot:<hash> rows can live here.
    },
    player_id: { type: DataTypes.TEXT, allowNull: false },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    artifact_id: { type: DataTypes.TEXT, allowNull: false },
    x: { type: DataTypes.INTEGER, allowNull: false },
    y: { type: DataTypes.INTEGER, allowNull: false },
    width: { type: DataTypes.INTEGER, allowNull: false },
    height: { type: DataTypes.INTEGER, allowNull: false },
    bag_id: { type: DataTypes.TEXT },
    sort_order: { type: DataTypes.INTEGER, allowNull: false },
    purchased_round: { type: DataTypes.INTEGER, allowNull: false },
    fresh_purchase: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_run_loadout_items',
    timestamps: false,
    indexes: [
      { fields: ['game_run_id', 'player_id', 'round_number'], name: 'idx_grli_run_player_round' },
      { fields: ['round_number'], name: 'idx_grli_round' }
    ]
  });
}
