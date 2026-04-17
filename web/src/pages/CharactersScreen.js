export const CharactersScreen = {
  name: 'CharactersScreen',
  props: ['state', 't', 'portraitPosition'],
  emits: ['save-character'],
  template: `
    <section class="character-grid">
      <article class="character-card" v-for="mushroom in state.bootstrap.mushrooms" :key="mushroom.id" role="button" tabindex="0" @click="$emit('save-character', mushroom.id)" @keydown.enter.prevent="$emit('save-character', mushroom.id)">
        <div class="card-portrait-wrap">
          <img :src="mushroom.imagePath" :alt="mushroom.name[state.lang]" class="portrait character-portrait" :style="{ objectPosition: portraitPosition(mushroom.id) }"/>
          <h3 class="card-portrait-name">{{ mushroom.name[state.lang] }}</h3>
        </div>
        <div class="character-card-meta">
          <span class="fighter-style-tag">{{ mushroom.styleTag }}</span>
          <span class="card-stats">{{ mushroom.baseStats.health }} HP · {{ mushroom.baseStats.attack }} ATK · {{ mushroom.baseStats.speed }} SPD</span>
        </div>
      </article>
    </section>
  `
};
