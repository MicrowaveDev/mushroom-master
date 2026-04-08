import { DataTypes } from 'sequelize';

export default function defineGameRunPlayer(sequelize) {
  return sequelize.define('GameRunPlayer', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    game_run_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'game_runs', key: 'id' }, onDelete: 'CASCADE' },
    player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    is_active: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    completed_rounds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    losses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lives_remaining: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    coins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    tableName: 'game_run_players',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['player_id'],
        where: { is_active: 1 },
        name: 'idx_one_active_run_per_player'
      }
    ]
  });
}
