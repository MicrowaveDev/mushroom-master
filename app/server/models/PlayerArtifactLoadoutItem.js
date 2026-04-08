import { DataTypes } from 'sequelize';

export default function definePlayerArtifactLoadoutItem(sequelize) {
  return sequelize.define('PlayerArtifactLoadoutItem', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    loadout_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'player_artifact_loadouts', key: 'id' }, onDelete: 'CASCADE' },
    artifact_id: { type: DataTypes.TEXT, allowNull: false },
    x: { type: DataTypes.INTEGER, allowNull: false },
    y: { type: DataTypes.INTEGER, allowNull: false },
    width: { type: DataTypes.INTEGER, allowNull: false },
    height: { type: DataTypes.INTEGER, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false },
    purchased_round: { type: DataTypes.INTEGER },
    bag_id: { type: DataTypes.TEXT }
  }, {
    tableName: 'player_artifact_loadout_items',
    timestamps: false
  });
}
