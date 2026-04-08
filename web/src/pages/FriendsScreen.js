export const FriendsScreen = {
  name: 'FriendsScreen',
  props: ['state', 't'],
  emits: ['add-friend', 'challenge-friend', 'accept-challenge', 'decline-challenge'],
  template: `
    <section class="grid cards">
      <article class="panel">
        <h2>{{ t.friends }}</h2>
        <p>{{ t.friendCode }}: {{ state.bootstrap.player.friendCode }}</p>
        <form class="row" @submit.prevent="$emit('add-friend', $event)">
          <input name="friendCode" :placeholder="t.friendCode" />
          <button class="primary" type="submit">{{ t.addFriend }}</button>
        </form>
      </article>
      <article class="panel">
        <h3>{{ state.lang === 'ru' ? 'Состав' : 'Roster' }}</h3>
        <button v-for="friend in state.friends" :key="friend.id" class="log-entry" @click="$emit('challenge-friend', friend.id)">
          {{ friend.name }} · {{ t.createChallenge }}
        </button>
      </article>
      <article class="panel" v-if="state.challenge">
        <h3>{{ state.lang === 'ru' ? 'Вызов' : 'Challenge' }}</h3>
        <p>{{ state.challenge.status }}</p>
        <button class="primary" @click="$emit('accept-challenge')">{{ t.acceptChallenge }}</button>
        <button class="secondary" @click="$emit('decline-challenge')">{{ t.declineChallenge }}</button>
      </article>
    </section>
  `
};
