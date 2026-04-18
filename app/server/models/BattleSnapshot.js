import { DataTypes } from 'sequelize';

export default function defineBattleSnapshot(sequelize) {
  return sequelize.define('BattleSnapshot', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    battle_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'battles', key: 'id' }, onDelete: 'CASCADE' },
    side: { type: DataTypes.TEXT, allowNull: false },
    player_id: { type: DataTypes.TEXT },
    mushroom_id: { type: DataTypes.TEXT, allowNull: false },
    mushroom_name: { type: DataTypes.TEXT, allowNull: false },
    payload_json: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'battle_snapshots',
    timestamps: false
  });
}
