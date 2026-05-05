import { DataTypes } from 'sequelize';

export default function defineClientEvent(sequelize) {
  return sequelize.define('ClientEvent', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    event: { type: DataTypes.TEXT, allowNull: false },
    game_run_id: { type: DataTypes.TEXT },
    detail_json: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
    created_at: { type: DataTypes.TEXT, allowNull: false }
  }, {
    tableName: 'client_events',
    timestamps: false,
    indexes: [
      { fields: ['event', 'created_at'], name: 'idx_client_events_event_created' },
      { fields: ['player_id', 'created_at'], name: 'idx_client_events_player_created' }
    ]
  });
}
