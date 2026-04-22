export const WikiScreen = {
  name: 'WikiScreen',
  props: ['state', 't'],
  emits: ['open-wiki'],
  data() {
    return {
      activeCategory: 'all',
      query: ''
    };
  },
  computed: {
    categories() {
      return [
        { key: 'all', labelRu: 'Все', labelEn: 'All', entries: this.allEntries },
        { key: 'characters', labelRu: 'Персонажи', labelEn: 'Characters', entries: this.state.wikiHome?.characters || [] },
        { key: 'locations', labelRu: 'Локации', labelEn: 'Locations', entries: this.state.wikiHome?.locations || [] },
        { key: 'factions', labelRu: 'Фракции', labelEn: 'Factions', entries: this.state.wikiHome?.factions || [] },
        { key: 'glossary', labelRu: 'Глоссарий', labelEn: 'Glossary', entries: this.state.wikiHome?.glossary || [] }
      ];
    },
    allEntries() {
      const home = this.state.wikiHome || {};
      return ['characters', 'locations', 'factions', 'glossary']
        .flatMap((section) => (home[section] || []).map((entry) => ({ ...entry, section })));
    },
    filteredEntries() {
      const source = this.activeCategory === 'all'
        ? this.allEntries
        : this.allEntries.filter((entry) => entry.section === this.activeCategory);
      const needle = this.query.trim().toLowerCase();
      if (!needle) {
        return source;
      }
      return source.filter((entry) => [
        entry.titleRu,
        entry.titleEn,
        entry.summaryRu,
        entry.summaryEn,
        entry.slug,
        entry.section
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
    }
  },
  methods: {
    label(item) {
      return this.state.lang === 'ru' ? item.labelRu : item.labelEn;
    },
    title(entry) {
      return this.state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu);
    },
    summary(entry) {
      return this.state.lang === 'ru' ? entry.summaryRu : (entry.summaryEn || entry.summaryRu);
    },
    categoryName(section) {
      const found = this.categories.find((category) => category.key === section);
      return found ? this.label(found) : section;
    }
  },
  template: `
    <section class="wiki-home">
      <header class="wiki-cover panel">
        <p class="eyebrow">{{ t.wiki }}</p>
        <h2>{{ state.lang === 'ru' ? 'Мицелиальная библиотека' : 'Mycelium Library' }}</h2>
        <p class="wiki-cover-copy">
          {{ state.lang === 'ru'
            ? 'Персонажи, места, фракции и термины мира собраны в одном живом справочнике.'
            : 'Characters, places, factions, and terms are gathered into one living field guide.' }}
        </p>
        <label class="wiki-search">
          <span>{{ state.lang === 'ru' ? 'Поиск' : 'Search' }}</span>
          <input v-model="query" type="search" :placeholder="state.lang === 'ru' ? 'Тхалла, Игг-Мицель, споры...' : 'Thalla, Ygg-Mycel, spore...'" />
        </label>
      </header>

      <nav class="wiki-category-tabs" :aria-label="t.wiki">
        <button
          v-for="category in categories"
          :key="category.key"
          type="button"
          class="wiki-category-tab"
          :class="{ active: activeCategory === category.key }"
          @click="activeCategory = category.key"
        >
          <span>{{ label(category) }}</span>
          <small>{{ category.entries.length }}</small>
        </button>
      </nav>

      <div class="wiki-entry-grid">
        <button
          v-for="entry in filteredEntries"
          :key="entry.section + ':' + entry.slug"
          type="button"
          class="wiki-entry-card log-entry"
          @click="$emit('open-wiki', [entry.section, entry.slug])"
        >
          <img v-if="entry.imagePath" :src="entry.imagePath" :alt="title(entry)" class="wiki-entry-card-media" />
          <span v-else class="wiki-entry-card-index">{{ categoryName(entry.section).slice(0, 2) }}</span>
          <span class="wiki-entry-card-copy">
            <span class="wiki-entry-card-kicker">{{ categoryName(entry.section) }}</span>
            <strong>{{ title(entry) }}</strong>
            <span>{{ summary(entry) }}</span>
          </span>
        </button>
      </div>

      <p v-if="filteredEntries.length === 0" class="wiki-empty">
        {{ state.lang === 'ru' ? 'Ничего не найдено.' : 'No entries found.' }}
      </p>
    </section>
  `
};
