import { DataTypes } from 'sequelize';

export default function defineBattleEvent(sequelize) {
  return sequelize.define('BattleEvent', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    battle_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'battles', key: 'id' }, onDelete: 'CASCADE' },
    event_index: { type: DataTypes.INTEGER, allowNull: false },
    event_type: { type: DataTypes.TEXT, allowNull: false },
    payload_json: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'battle_events',
    timestamps: false
  });
}
