export const WikiDetailScreen = {
  name: 'WikiDetailScreen',
  props: ['state', 't'],
  emits: ['go'],
  template: `
    <section class="panel stack">
      <button class="ghost" @click="$emit('go', 'wiki')">{{ t.wiki }}</button>
      <h2>{{ state.lang === 'ru' ? state.selectedWiki.title_ru : state.selectedWiki.title_en }}</h2>
      <img v-if="state.selectedWiki.image" :src="state.selectedWiki.image" :alt="state.selectedWiki.title_ru" class="portrait"/>
      <div v-html="state.selectedWiki.html"></div>
    </section>
  `
};
