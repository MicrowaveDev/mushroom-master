import { DataTypes } from 'sequelize';

export default function defineFriendChallenge(sequelize) {
  return sequelize.define('FriendChallenge', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    challenge_token: { type: DataTypes.TEXT, unique: true, allowNull: false },
    challenger_player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    invitee_player_id: { type: DataTypes.TEXT, allowNull: false, references: { model: 'players', key: 'id' }, onDelete: 'CASCADE' },
    status: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    expires_at: { type: DataTypes.TEXT, allowNull: false },
    accepted_at: { type: DataTypes.TEXT },
    battle_id: { type: DataTypes.TEXT },
    challenge_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'battle' },
    game_run_id: { type: DataTypes.TEXT, references: { model: 'game_runs', key: 'id' } }
  }, {
    tableName: 'friend_challenges',
    timestamps: false
  });
}
