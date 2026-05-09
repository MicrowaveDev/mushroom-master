import { DataTypes } from 'sequelize';

export default function defineGameRunFusion(sequelize) {
  return sequelize.define('GameRunFusion', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    source_round_number: { type: DataTypes.INTEGER, allowNull: false },
    result_round_number: { type: DataTypes.INTEGER, allowNull: false },
    recipe_id: { type: DataTypes.TEXT, allowNull: false },
    result_artifact_id: { type: DataTypes.TEXT, allowNull: false },
    result_row_id: { type: DataTypes.TEXT, allowNull: false },
    ingredient_artifact_ids_json: { type: DataTypes.TEXT, allowNull: false },
    ingredient_rows_json: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_run_fusions',
    timestamps: false,
    indexes: [
      { fields: ['game_run_id', 'player_id', 'result_round_number'], name: 'idx_grf_run_player_round' }
    ]
  });
}
