import { DataTypes } from 'sequelize';

export default function definePlayerWalletBalance(sequelize) {
  return sequelize.define('PlayerWalletBalance', {
    player_id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      references: { model: 'players', key: 'id' },
      onDelete: 'CASCADE'
    },
    currency_code: { type: DataTypes.TEXT, primaryKey: true },
    balance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_wallet_balances',
    timestamps: false
  });
}
