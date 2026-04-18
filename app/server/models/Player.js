import { DataTypes } from 'sequelize';

export default function definePlayer(sequelize) {
  return sequelize.define('Player', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    telegram_id: { type: DataTypes.TEXT, unique: true },
    telegram_username: { type: DataTypes.TEXT },
    name: { type: DataTypes.TEXT, allowNull: false },
    lang: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'ru' },
    spore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1000 },
    rated_battle_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    losses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    draws: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    friend_code: { type: DataTypes.TEXT, unique: true, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'players',
    timestamps: false
  });
}
