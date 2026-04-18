export const WikiDetailScreen = {
  name: 'WikiDetailScreen',
  props: ['state', 't'],
  emits: ['go'],
  template: `
    <section class="panel stack">
      <button class="ghost" @click="$emit('go', 'wiki')">{{ t.wiki }}</button>
      <h2>{{ state.lang === 'ru' ? state.selectedWiki.title_ru : state.selectedWiki.title_en }}</h2>
      <img v-if="state.selectedWiki.image" :src="state.selectedWiki.image" :alt="state.selectedWiki.title_ru" class="portrait"/>
      <template v-if="state.selectedWiki.sections">
        <div v-for="section in state.selectedWiki.sections" :key="section.tier">
          <div v-if="!section.locked" v-html="section.html"></div>
          <div v-else class="wiki-locked-section">
            <span class="wiki-lock-icon">&#x1F512;</span>
            <span>{{ t.wikiUnlockAt.replace('{n}', section.threshold) }}</span>
          </div>
        </div>
      </template>
      <div v-else v-html="state.selectedWiki.html"></div>
    </section>
  `
};
