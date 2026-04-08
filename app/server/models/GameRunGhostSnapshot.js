import { DataTypes } from 'sequelize';

export default function defineGameRunGhostSnapshot(sequelize) {
  return sequelize.define('GameRunGhostSnapshot', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    mushroom_id: { type: DataTypes.TEXT, allowNull: false },
    payload_json: { type: DataTypes.TEXT, allowNull: false },
    total_coins: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_run_ghost_snapshots',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['player_id', 'game_run_id', 'round_number'] }
    ]
  });
}
