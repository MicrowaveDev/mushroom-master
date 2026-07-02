import { DataTypes } from 'sequelize';

export default function defineMutationClaim(sequelize) {
  return sequelize.define('MutationClaim', {
    scope: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
    claim_key: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
    claim_token: { type: DataTypes.TEXT, allowNull: false },
    claimed_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'mutation_claims',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['scope', 'claim_key'], name: 'idx_mutation_claims_scope_key' }
    ]
  });
}
