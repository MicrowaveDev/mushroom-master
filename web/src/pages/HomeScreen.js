import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const HomeScreen = {
  name: 'HomeScreen',
  props: [
    'state', 't', 'activeMushroom', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'getMushroom',
    'describeReplay', 'formatDelta', 'portraitPosition'
  ],
  emits: [
    'resume-run', 'start-run', 'abandon-run',
    'load-replay', 'go',
    'add-friend', 'challenge-friend',
    'accept-challenge', 'decline-challenge',
    'select-mushroom',
    'switch-portrait', 'switch-preset'
  ],
  data() {
    return { expandedMushroomId: null };
  },
  components: {
    ArtifactGridBoard: defineAsyncComponent(() => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard))
  },
  computed: {
    playerRank() {
      const id = this.state.bootstrap?.player?.id;
      if (!id || !this.state.leaderboard?.length) return null;
      const entry = this.state.leaderboard.find(e => e.id === id);
      return entry?.rank || null;
    },
    roster() {
      const mushrooms = this.state.bootstrap?.mushrooms || [];
      const progression = this.state.bootstrap?.progression || {};
      return mushrooms.map(m => {
        const prog = progression[m.id] || {};
        return {
          ...m,
          level: prog.level || 1,
          tier: prog.tier || 'spore',
          currentLevelMycelium: prog.currentLevelMycelium || 0,
          nextLevelMycelium: prog.nextLevelMycelium ?? null,
          wins: prog.wins || 0,
          losses: prog.losses || 0,
          draws: prog.draws || 0,
          isActive: m.id === this.state.bootstrap?.activeMushroomId,
          activePortrait: prog.activePortrait || 'default',
          portraitUrl: prog.activePortraitUrl || m.imagePath,
          portraits: prog.portraits || [],
          activePreset: prog.activePreset || 'default',
          presets: prog.presets || []
        };
      });
    },
    topLeaderboard() {
      return (this.state.leaderboard || []).slice(0, 5);
    }
  },
  template: `
    <section class="home">
      <!-- Two-column layout: Mushrooms + Battles -->
      <div class="home-columns">
        <!-- Mushrooms list -->
        <article class="panel home-section">
          <h3>{{ t.characters }}</h3>
          <div class="home-mushroom-list">
            <div v-for="m in roster" :key="m.id" class="home-mushroom-card">
              <div
                class="home-mushroom-row"
                :class="{ 'home-mushroom-row--active': m.isActive }"
                @click="$emit('select-mushroom', m.id)"
                role="button" tabindex="0"
              >
                <img :src="m.portraitUrl" :alt="m.name[state.lang]" class="home-mushroom-portrait" :style="{ objectPosition: portraitPosition(m.id) }"/>
                <div class="home-mushroom-info">
                  <div class="home-mushroom-name-row">
                    <strong>{{ m.name[state.lang] }}</strong>
                    <span v-if="m.isActive" class="home-mushroom-active-tag">{{ t.active }}</span>
                    <span :class="'home-mushroom-tier tier--' + m.tier">{{ t['tier_' + m.tier] }}</span>
                  </div>
                  <span class="home-mushroom-style">{{ m.styleTag }}</span>
                  <span class="home-mushroom-stats">
                    <span class="home-mushroom-level">{{ t.level }} {{ m.level }}</span>
                    <span v-if="m.wins || m.losses || m.draws" class="home-mushroom-record">{{ m.wins }}<small>{{ t.winsShort }}</small> {{ m.losses }}<small>{{ t.lossesShort }}</small> {{ m.draws }}<small>{{ t.drawsShort }}</small></span>
                  </span>
                  <div v-if="m.nextLevelMycelium !== null" class="home-mushroom-progress" :title="m.currentLevelMycelium + ' / ' + m.nextLevelMycelium">
                    <div class="home-mushroom-progress-fill" :style="{ width: Math.min(100, Math.round(m.currentLevelMycelium / m.nextLevelMycelium * 100)) + '%' }"></div>
                  </div>
                </div>
                <div class="home-mushroom-actions">
                  <button v-if="!m.isActive" class="ghost home-mushroom-select" @click.stop="$emit('select-mushroom', m.id)">{{ t.pick }}</button>
                  <button
                    v-if="m.portraits.length > 1 || m.presets.length > 1"
                    class="ghost home-mushroom-customize"
                    :class="{ 'home-mushroom-customize--open': expandedMushroomId === m.id }"
                    @click.stop="expandedMushroomId = expandedMushroomId === m.id ? null : m.id"
                    :title="t.customize"
                  >✎</button>
                </div>
              </div>

              <!-- Portrait + preset picker (expanded) -->
              <div v-if="expandedMushroomId === m.id" class="home-mushroom-picker">
                <!-- Portrait swatches -->
                <div v-if="m.portraits.length > 1" class="home-picker-section">
                  <span class="home-picker-label">{{ t.portraits }}</span>
                  <div class="home-portrait-swatches">
                    <button
                      v-for="p in m.portraits" :key="p.id"
                      class="home-portrait-swatch"
                      :class="{ 'home-portrait-swatch--active': m.activePortrait === p.id, 'home-portrait-swatch--locked': !p.unlocked }"
                      :title="p.unlocked ? p.name[state.lang] : t.portraitLocked.replace('{n}', p.cost)"
                      @click.stop="p.unlocked && $emit('switch-portrait', { mushroomId: m.id, portraitId: p.id })"
                    >
                      <img :src="p.path" :alt="p.name[state.lang]" />
                      <span v-if="!p.unlocked" class="home-swatch-lock">🔒</span>
                    </button>
                  </div>
                </div>

                <!-- Preset pills -->
                <div v-if="m.presets.length > 1" class="home-picker-section">
                  <span class="home-picker-label">{{ t.starterPreset }}</span>
                  <div class="home-preset-pills">
                    <button
                      v-for="p in m.presets" :key="p.id"
                      class="home-preset-pill"
                      :class="{ 'home-preset-pill--active': m.activePreset === p.id, 'home-preset-pill--locked': !p.unlocked }"
                      :title="p.unlocked ? '' : t.presetLocked.replace('{n}', p.requiredLevel)"
                      @click.stop="p.unlocked && $emit('switch-preset', { mushroomId: m.id, presetId: p.id })"
                    >{{ p.name[state.lang] }}{{ !p.unlocked ? ' 🔒' : '' }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- Battles list -->
        <article class="panel home-section">
          <div class="home-section-header">
            <h3>{{ t.gameRuns }}</h3>
            <button v-if="!state.gameRun && activeMushroom" class="primary home-start-btn" :disabled="state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit" :title="state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit ? t.dailyLimitReached : ''" @click="$emit('start-run', 'solo')">{{ t.startRun }}</button>
            <button v-if="state.bootstrap.battleHistory?.length" class="link" @click="$emit('go', 'history')">{{ t.viewAll }}</button>
          </div>

          <p v-if="!state.gameRun && state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit" class="home-limit-hint">{{ t.dailyLimitReached }}</p>

          <!-- Active run as first item -->
          <div v-if="state.gameRun && activeMushroom" class="home-battle-item home-battle-item--active" @click="$emit('resume-run')">
            <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="home-battle-item-portrait" :style="{ objectPosition: portraitPosition(activeMushroom.id) }"/>
            <div class="home-battle-item-info">
              <strong>{{ t.round }} {{ state.gameRun.currentRound }}</strong>
              <span class="home-battle-item-stats">{{ t.wins }} {{ state.gameRun.player?.wins || 0 }} · {{ t.lives }} {{ state.gameRun.player?.livesRemaining || 0 }}</span>
            </div>
            <button class="primary home-battle-item-action" @click.stop="$emit('resume-run')">{{ t.continueRound }}</button>
          </div>

          <!-- Recent battles -->
          <div v-if="state.bootstrap.battleHistory?.length" class="home-battle-list">
            <div
              v-for="battle in state.bootstrap.battleHistory.slice(0, 5)"
              :key="battle.id"
              class="home-battle-item"
              :class="'home-battle-item--' + (describeReplay(battle)?.outcomeKey || 'draw')"
              @click="$emit('load-replay', battle.id)"
            >
              <img v-if="describeReplay(battle)?.oppImage" :src="describeReplay(battle).oppImage" :alt="describeReplay(battle)?.oppName" class="home-battle-item-portrait" />
              <div class="home-battle-item-info">
                <strong>{{ describeReplay(battle)?.outcomeLabel }}</strong>
                <span class="home-battle-item-stats">{{ describeReplay(battle)?.oppName }} · {{ describeReplay(battle)?.opponentKindLabel }}</span>
              </div>
              <span class="home-battle-item-date">{{ describeReplay(battle)?.dateLabel }}</span>
            </div>
          </div>

          <!-- Empty state -->
          <p v-if="!state.gameRun && !state.bootstrap.battleHistory?.length" class="home-empty-hint home-empty-hint--center">{{ t.noBattlesYet }}</p>

          <!-- Footer stats -->
          <div class="home-battle-footer">
            <span>{{ t.spore }}: {{ state.bootstrap.player.spore }}</span>
            <span>{{ t.battleLimit }}: {{ state.bootstrap.battleLimit.used }} / {{ state.bootstrap.battleLimit.limit }}</span>
          </div>
        </article>
      </div>

      <!-- Friends + Leaderboard -->
      <div class="home-columns">
        <!-- Friends -->
        <article class="panel home-friends-compact friends-panel">
          <div class="home-section-header">
            <h3>{{ t.friends }} <span v-if="state.friends?.length" class="home-friends-count">{{ state.friends.length }}</span></h3>
          </div>
          <div v-if="state.challenge" class="home-challenge-banner">
            <span>{{ state.challenge.status === 'pending' ? t.pendingChallenge : state.challenge.status }}</span>
            <div class="home-challenge-actions">
              <button class="primary" @click="$emit('accept-challenge')">{{ t.acceptChallenge }}</button>
              <button class="ghost" @click="$emit('decline-challenge')">{{ t.declineChallenge }}</button>
            </div>
          </div>
          <div class="home-friends-list" v-if="state.friends?.length">
            <div v-for="friend in state.friends.slice(0, 3)" :key="friend.id" class="home-friend-row">
              <div class="home-friend-info">
                <strong>{{ friend.name }}</strong>
                <span class="home-friend-rating">{{ friend.rating }}</span>
              </div>
              <button class="secondary home-friend-challenge" @click="$emit('challenge-friend', friend.id)">{{ t.createChallenge }}</button>
            </div>
            <button v-if="state.friends.length > 3" class="link" @click="$emit('go', 'friends')">{{ t.viewAll }}</button>
          </div>
          <div v-else class="home-empty-hint">
            <p>{{ t.noFriendsYet }}</p>
          </div>
          <form class="home-add-friend-row" @submit.prevent="$emit('add-friend', $event)">
            <input name="friendCode" :placeholder="t.friendCode" class="home-friend-input" />
            <button class="primary" type="submit">{{ t.addFriend }}</button>
          </form>
          <span class="home-friend-code">{{ t.yourCode }}: <strong>{{ state.bootstrap.player.friendCode }}</strong></span>
        </article>

        <!-- Leaderboard -->
        <article class="panel home-section leaderboard-panel" v-if="topLeaderboard.length">
          <div class="home-section-header">
            <h3>{{ t.leaderboard }}</h3>
            <button class="link" @click="$emit('go', 'leaderboard')">{{ t.viewAll }}</button>
          </div>
          <div class="home-leaderboard">
            <div
              v-for="entry in topLeaderboard" :key="entry.id"
              class="home-leaderboard-row"
              :class="{ 'home-leaderboard-row--self': entry.id === state.bootstrap.player.id }"
            >
              <span class="home-leaderboard-rank">#{{ entry.rank }}</span>
              <strong class="home-leaderboard-name">{{ entry.name }}</strong>
              <span class="home-leaderboard-rating">{{ entry.rating }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  `
};
