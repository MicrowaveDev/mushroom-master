export const BattlePrepScreen = {
  name: 'BattlePrepScreen',
  props: ['state', 't', 'activeMushroom', 'builderTotals', 'usedCoins', 'maxCoins', 'portraitPosition', 'renderArtifactFigure', 'getArtifact'],
  emits: ['start-battle'],
  components: {
    ArtifactGridBoard: () => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard)
  },
  template: `
    <section class="battle-prep-screen">
      <div class="battle-prep-card">
        <div class="battle-prep-portrait-wrap">
          <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="battle-prep-portrait" :style="{ objectPosition: portraitPosition(activeMushroom.id) }"/>
          <div class="battle-prep-portrait-overlay">
            <h3>{{ activeMushroom.name[state.lang] }}</h3>
            <div class="battle-prep-tags">
              <span class="fighter-style-tag">{{ activeMushroom.styleTag }}</span>
              <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.health }} HP</span>
              <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.attack }} ATK</span>
              <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.speed }} SPD</span>
            </div>
          </div>
        </div>
        <div class="battle-prep-loadout" v-if="state.builderItems.length">
          <artifact-grid-board
            variant="inventory" class="inventory-shell battle-prep-inventory"
            :items="state.builderItems" :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          />
          <span class="battle-prep-loadout-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
        </div>
      </div>
      <button class="primary battle-prep-cta" :disabled="usedCoins > maxCoins" @click="$emit('start-battle')">{{ t.startBattle }}</button>
    </section>
  `
};
