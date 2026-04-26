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
    // x, y are absolute shared-grid coords for every placed row. Container
    // rows use (-1, -1). Bag membership is derived from cell overlap.
    x: { type: DataTypes.INTEGER, allowNull: false },
    y: { type: DataTypes.INTEGER, allowNull: false },
    width: { type: DataTypes.INTEGER, allowNull: false },
    height: { type: DataTypes.INTEGER, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false },
    purchased_round: { type: DataTypes.INTEGER, allowNull: false },
    fresh_purchase: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Activation state for bag rows. 1 if the bag is in the "active
    // bags bar" (its extra rows are exposed on the grid); 0 if it's in
    // the container (unactivated). Non-bag rows are always 0 — they
    // don't have an activation concept. See docs/bag-active-persistence.md.
    active: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Rotation state for bag rows. 1 if the bag is displayed in its
    // alternate (width↔height swapped) orientation; 0 for the canonical
    // orientation. Non-bag rows are always 0. See
    // docs/bag-rotated-persistence.md.
    rotated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
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
