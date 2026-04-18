import { DataTypes } from 'sequelize';

export default function defineAuthCode(sequelize) {
  return sequelize.define('AuthCode', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    provider: { type: DataTypes.TEXT, allowNull: false },
    private_code: { type: DataTypes.TEXT, unique: true, allowNull: false },
    public_code: { type: DataTypes.TEXT, unique: true, allowNull: false },
    user_id: { type: DataTypes.TEXT, references: { model: 'players', key: 'id' }, onDelete: 'SET NULL' },
    used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expires_at: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'auth_codes',
    timestamps: false
  });
}
