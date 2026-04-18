import { DataTypes } from 'sequelize';

export default function definePlayerActiveCharacter(sequelize) {
  return sequelize.define('PlayerActiveCharacter', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    mushroom_id: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_active_character',
    timestamps: false
  });
}
