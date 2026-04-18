import { DataTypes } from 'sequelize';

export default function definePlayerSettings(sequelize) {
  return sequelize.define('PlayerSettings', {
    player_id: { type: DataTypes.TEXT, primaryKey: true, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    lang: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'ru' },
    reduced_motion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    battle_speed: { type: DataTypes.TEXT, allowNull: false, defaultValue: '1x' }
  }, {
    tableName: 'player_settings',
    timestamps: false
  });
}
