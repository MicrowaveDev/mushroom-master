import { DataTypes } from 'sequelize';

export default function definePlayerMushroom(sequelize) {
  return sequelize.define('PlayerMushroom', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    mushroom_id: { type: DataTypes.TEXT, primaryKey: true },
    mycelium: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    losses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    draws: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    tableName: 'player_mushrooms',
    timestamps: false
  });
}
