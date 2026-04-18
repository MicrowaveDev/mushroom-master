export const WikiScreen = {
  name: 'WikiScreen',
  props: ['state', 't'],
  emits: ['open-wiki'],
  computed: {
    wikiTitle() {
      return (entry) => state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu);
    }
  },
  template: `
    <section class="grid cards">
      <article class="panel">
        <h2>{{ t.wiki }}</h2>
        <div class="stack">
          <button v-for="entry in state.wikiHome?.characters || []" :key="entry.slug" class="log-entry" @click="$emit('open-wiki', ['characters', entry.slug])">
            {{ state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu) }}
          </button>
        </div>
      </article>
      <article class="panel">
        <h3>{{ t.wikiLocations }}</h3>
        <button v-for="entry in state.wikiHome?.locations || []" :key="entry.slug" class="log-entry" @click="$emit('open-wiki', ['locations', entry.slug])">
          {{ state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu) }}
        </button>
      </article>
      <article class="panel">
        <h3>{{ t.wikiFactions }}</h3>
        <button v-for="entry in state.wikiHome?.factions || []" :key="entry.slug" class="log-entry" @click="$emit('open-wiki', ['factions', entry.slug])">
          {{ state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu) }}
        </button>
      </article>
    </section>
  `
};
