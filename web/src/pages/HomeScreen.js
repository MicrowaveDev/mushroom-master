export const HomeScreen = {
  name: 'HomeScreen',
  props: [
    'state', 't', 'activeMushroom', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'getMushroom',
    'describeReplay', 'formatDelta', 'portraitPosition'
  ],
  emits: ['resume-run', 'start-run', 'load-replay', 'go'],
  components: {
    ArtifactGridBoard: () => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard)
  },
  template: `
    <section class="dashboard">
      <article class="panel player-summary">
        <h2>{{ state.bootstrap.player.name }}</h2>
        <dl class="stat-grid">
          <div class="stat"><dt>{{ t.rating }}</dt><dd>{{ state.bootstrap.player.rating }}</dd></div>
          <div class="stat"><dt>{{ t.spore }}</dt><dd>{{ state.bootstrap.player.spore }}</dd></div>
          <div class="stat"><dt>{{ t.battleLimit }}</dt><dd>{{ state.bootstrap.battleLimit.used }} / {{ state.bootstrap.battleLimit.limit }}</dd></div>
        </dl>
      </article>
      <article class="panel" v-if="activeMushroom">
        <button v-if="state.gameRun" class="primary" style="width:100%" @click="$emit('resume-run')">{{ t.resumeRun }} ({{ t.round }} {{ state.gameRun.currentRound }})</button>
        <button v-else class="primary" style="width:100%" @click="$emit('start-run', 'solo')">{{ t.startRun }}</button>
      </article>
      <article class="panel active-mushroom" v-if="activeMushroom">
        <div class="active-mushroom-media">
          <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="portrait"/>
          <span class="active-mushroom-badge">{{ t.active }}</span>
        </div>
        <h3>{{ activeMushroom.name[state.lang] }}</h3>
      </article>
      <article class="panel">
        <h3>{{ t.selectedArtifacts }}</h3>
        <artifact-grid-board
          v-if="state.builderItems.length"
          variant="inventory"
          class="inventory-shell home-inventory"
          :items="state.builderItems"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
        />
        <p v-else>{{ t.selectCell }}</p>
      </article>
      <article class="panel" v-if="Object.keys(state.bootstrap.progression || {}).length">
        <h3>{{ t.profile }}</h3>
        <div class="progression-list">
          <div v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId" class="progression-entry">
            <strong>{{ getMushroom(entry.mushroomId)?.name?.[state.lang] || entry.mushroomId }}</strong>
            <span>{{ t.level }} {{ entry.level }} · {{ t.mycelium }} {{ entry.mycelium }}</span>
          </div>
        </div>
      </article>
      <article class="panel panel-wide" v-if="state.bootstrap.battleHistory?.length">
        <h3>{{ t.history }}</h3>
        <ul class="replay-list">
          <li
            v-for="battle in state.bootstrap.battleHistory"
            :key="battle.id"
            class="replay-card"
            :class="'replay-card--' + (describeReplay(battle)?.outcomeKey || 'draw')"
            @click="$emit('load-replay', battle.id)"
            role="button" tabindex="0"
            @keydown.enter.prevent="$emit('load-replay', battle.id)"
            @keydown.space.prevent="$emit('load-replay', battle.id)"
          >
            <div class="replay-card-header">
              <span class="replay-card-outcome">{{ describeReplay(battle)?.outcomeLabel }}</span>
              <span class="replay-card-meta">
                <span class="replay-card-kind">{{ describeReplay(battle)?.opponentKindLabel }}</span>
                <span class="replay-card-date">{{ describeReplay(battle)?.dateLabel }}</span>
              </span>
            </div>
            <div class="replay-card-matchup">
              <div class="replay-card-fighter">
                <img v-if="describeReplay(battle)?.ourImage" :src="describeReplay(battle).ourImage" :alt="describeReplay(battle)?.ourName" class="replay-card-portrait" />
                <span class="replay-card-name">{{ describeReplay(battle)?.ourName }}</span>
              </div>
              <span class="replay-card-vs">vs</span>
              <div class="replay-card-fighter">
                <img v-if="describeReplay(battle)?.oppImage" :src="describeReplay(battle).oppImage" :alt="describeReplay(battle)?.oppName" class="replay-card-portrait" />
                <span class="replay-card-name">{{ describeReplay(battle)?.oppName }}</span>
              </div>
            </div>
            <div class="replay-card-rewards" v-if="describeReplay(battle)?.ratingDelta != null || describeReplay(battle)?.sporeDelta || describeReplay(battle)?.myceliumDelta">
              <span v-if="describeReplay(battle)?.ratingDelta != null" class="replay-chip">{{ t.rating }} {{ formatDelta(describeReplay(battle).ratingDelta) }}</span>
              <span v-if="describeReplay(battle)?.sporeDelta" class="replay-chip">{{ t.spore }} {{ formatDelta(describeReplay(battle).sporeDelta) }}</span>
              <span v-if="describeReplay(battle)?.myceliumDelta" class="replay-chip">{{ t.mycelium }} {{ formatDelta(describeReplay(battle).myceliumDelta) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>
  `
};
