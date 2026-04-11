import { DataTypes } from 'sequelize';

export default function defineGameRunRefund(sequelize) {
  return sequelize.define('GameRunRefund', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    round_number: { type: DataTypes.INTEGER, allowNull: false },
    artifact_id: { type: DataTypes.TEXT, allowNull: false },
    refund_amount: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'game_run_refunds',
    timestamps: false,
    indexes: [
      { fields: ['game_run_id', 'player_id'], name: 'idx_grr_run_player' }
    ]
  });
}
