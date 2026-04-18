export const LeaderboardScreen = {
  name: 'LeaderboardScreen',
  props: ['state', 't'],
  template: `
    <section class="panel stack">
      <h2>{{ t.leaderboard }}</h2>
      <div class="leaderboard-row" v-for="entry in state.leaderboard" :key="entry.id">
        <strong>#{{ entry.rank }}</strong>
        <span>{{ entry.name }}</span>
        <span>{{ entry.rating }}</span>
      </div>
    </section>
  `
};
