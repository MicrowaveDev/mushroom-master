import { DataTypes } from 'sequelize';

export default function definePlayerArtifactLoadout(sequelize) {
  return sequelize.define('PlayerArtifactLoadout', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, unique: true, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    mushroom_id: { type: DataTypes.TEXT, allowNull: false },
    grid_width: { type: DataTypes.INTEGER, allowNull: false },
    grid_height: { type: DataTypes.INTEGER, allowNull: false },
    is_active: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    updated_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'player_artifact_loadouts',
    timestamps: false
  });
}
