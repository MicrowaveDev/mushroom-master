import { DataTypes } from 'sequelize';

export default function defineFriendship(sequelize) {
  return sequelize.define('Friendship', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_low_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    player_high_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'friendships',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['player_low_id', 'player_high_id'] }
    ]
  });
}
