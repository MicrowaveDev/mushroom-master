import { DataTypes } from 'sequelize';

export default function defineSupportAction(sequelize) {
  return sequelize.define('SupportAction', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    actor_id: { type: DataTypes.TEXT, allowNull: false },
    action_type: { type: DataTypes.TEXT, allowNull: false },
    player_id: { type: DataTypes.TEXT },
    target_type: { type: DataTypes.TEXT, allowNull: false },
    target_id: { type: DataTypes.TEXT },
    status: { type: DataTypes.TEXT, allowNull: false },
    reason: { type: DataTypes.TEXT },
    note: { type: DataTypes.TEXT },
    evidence_json: { type: DataTypes.TEXT },
    result_json: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'support_actions',
    timestamps: false,
    indexes: [
      { fields: ['player_id', 'created_at'], name: 'idx_support_actions_player_time' },
      { fields: ['target_type', 'target_id'], name: 'idx_support_actions_target' },
      { fields: ['action_type', 'created_at'], name: 'idx_support_actions_action_time' }
    ]
  });
}
