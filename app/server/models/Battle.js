import { DataTypes } from 'sequelize';

export default function defineBattle(sequelize) {
  return sequelize.define('Battle', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    mode: { type: DataTypes.TEXT, allowNull: false },
    initiator_player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    opponent_player_id: { type: DataTypes.TEXT, references: { model: 'players', key: 'id' }, onDelete: 'SET NULL' },
    opponent_kind: { type: DataTypes.TEXT, allowNull: false },
    rated_scope: { type: DataTypes.TEXT, allowNull: false },
    battle_seed: { type: DataTypes.TEXT, allowNull: false },
    outcome: { type: DataTypes.TEXT, allowNull: false },
    winner_side: { type: DataTypes.TEXT },
    challenger_challenge_id: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    completed_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'battles',
    timestamps: false
  });
}
