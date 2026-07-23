import { LeaderboardScreen as CoreLeaderboardScreen } from '@microwavedev/backpack-game-core/vue/pages';

export const LeaderboardScreen = {
  name: 'MushroomLeaderboardScreen',
  components: { CoreLeaderboardScreen },
  props: ['state', 't'],
  template: `
    <core-leaderboard-screen
      :entries="state.leaderboard"
      :title="t.leaderboard"
    />
  `
};
