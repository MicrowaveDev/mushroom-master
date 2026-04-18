import { DataTypes } from 'sequelize';

export default function defineLocalTestRun(sequelize) {
  return sequelize.define('LocalTestRun', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    payload_json: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'local_test_runs',
    timestamps: false
  });
}
