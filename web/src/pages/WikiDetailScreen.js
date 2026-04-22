const WikiInline = {
  name: 'WikiInline',
  props: {
    tokens: { type: Array, default: () => [] }
  },
  template: `
    <template v-for="(token, index) in tokens" :key="index">
      <span v-if="token.type === 'text'">{{ token.text }}</span>
      <strong v-else-if="token.type === 'strong'"><wiki-inline :tokens="token.children || []" /></strong>
      <em v-else-if="token.type === 'em'"><wiki-inline :tokens="token.children || []" /></em>
      <del v-else-if="token.type === 'del'"><wiki-inline :tokens="token.children || []" /></del>
      <code v-else-if="token.type === 'code'">{{ token.text }}</code>
      <br v-else-if="token.type === 'br'" />
      <a v-else-if="token.type === 'link'" :href="token.href" target="_blank" rel="noreferrer">
        <wiki-inline :tokens="token.children || []" />
      </a>
      <img v-else-if="token.type === 'image'" :src="token.href" :alt="token.text" class="wiki-inline-image" />
    </template>
  `
};

const WikiBlock = {
  name: 'WikiBlock',
  components: { WikiInline },
  props: {
    block: { type: Object, required: true }
  },
  template: `
    <h2 v-if="block.type === 'heading' && block.depth <= 2" class="wiki-article-heading">
      <wiki-inline :tokens="block.inline || []" />
    </h2>
    <h3 v-else-if="block.type === 'heading'" class="wiki-article-subheading">
      <wiki-inline :tokens="block.inline || []" />
    </h3>
    <p v-else-if="block.type === 'paragraph'" class="wiki-article-paragraph">
      <wiki-inline :tokens="block.inline || []" />
    </p>
    <ol v-else-if="block.type === 'list' && block.ordered" class="wiki-article-list">
      <li v-for="(item, index) in block.items" :key="index"><wiki-inline :tokens="item.inline || []" /></li>
    </ol>
    <ul v-else-if="block.type === 'list'" class="wiki-article-list">
      <li v-for="(item, index) in block.items" :key="index"><wiki-inline :tokens="item.inline || []" /></li>
    </ul>
    <blockquote v-else-if="block.type === 'blockquote'" class="wiki-article-quote">
      <wiki-block v-for="(child, index) in block.blocks || []" :key="index" :block="child" />
    </blockquote>
    <hr v-else-if="block.type === 'hr'" class="wiki-article-rule" />
    <pre v-else-if="block.type === 'code'" class="wiki-article-code"><code>{{ block.text }}</code></pre>
  `
};

export const WikiDetailScreen = {
  name: 'WikiDetailScreen',
  components: { WikiBlock },
  props: ['state', 't'],
  emits: ['go', 'open-wiki'],
  computed: {
    entry() {
      return this.state.selectedWiki || {};
    },
    title() {
      return this.state.lang === 'ru'
        ? this.entry.title_ru
        : (this.entry.title_en || this.entry.title_ru);
    },
    summary() {
      return this.state.lang === 'ru'
        ? this.entry.summary_ru
        : (this.entry.summary_en || this.entry.summary_ru);
    },
    visibleSections() {
      return this.entry.sections || [{ tier: 0, locked: false, blocks: this.entry.blocks || [] }];
    }
  },
  methods: {
    sectionLabel(section, index) {
      if (section.tier) {
        return this.state.lang === 'ru' ? `Уровень ${section.tier}` : `Tier ${section.tier}`;
      }
      return String(index + 1).padStart(2, '0');
    },
    titleFor(entry) {
      return this.state.lang === 'ru' ? entry.titleRu : (entry.titleEn || entry.titleRu);
    },
    summaryFor(entry) {
      return this.state.lang === 'ru' ? entry.summaryRu : (entry.summaryEn || entry.summaryRu);
    },
    articleBlocks(section) {
      const title = String(this.title || '').trim().toLowerCase();
      return (section.blocks || []).filter((block, index) => {
        if (index !== 0 || block.type !== 'heading' || block.depth !== 1) {
          return true;
        }
        return String(block.text || '').trim().toLowerCase() !== title;
      });
    }
  },
  template: `
    <article class="wiki-detail">
      <button class="ghost wiki-back-button" @click="$emit('go', 'wiki')">{{ t.wiki }}</button>

      <header class="wiki-detail-cover panel" :class="{ 'has-media': entry.image }">
        <img v-if="entry.image" :src="entry.image" :alt="title" class="wiki-detail-portrait" />
        <div class="wiki-detail-cover-copy">
          <p class="eyebrow">{{ t.wiki }}</p>
          <h2>{{ title }}</h2>
          <p v-if="summary" class="wiki-detail-summary">{{ summary }}</p>
        </div>
      </header>

      <section class="wiki-section-list">
        <div
          v-for="(section, index) in visibleSections"
          :key="section.tier ?? index"
          class="wiki-section-card"
          :class="{ 'is-locked': section.locked }"
        >
          <div class="wiki-section-index">{{ sectionLabel(section, index) }}</div>
          <div class="wiki-section-copy">
            <template v-if="!section.locked">
              <wiki-block
                v-for="(block, blockIndex) in articleBlocks(section)"
                :key="blockIndex"
                :block="block"
              />
            </template>
            <div v-else class="wiki-locked-section">
              <span class="wiki-lock-icon" aria-hidden="true"></span>
              <span>{{ t.wikiUnlockAt.replace('{n}', section.threshold) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="entry.relatedEntries?.length" class="wiki-related panel">
        <p class="eyebrow">{{ state.lang === 'ru' ? 'Связанные записи' : 'Related entries' }}</p>
        <div class="wiki-related-grid">
          <button
            v-for="related in entry.relatedEntries"
            :key="related.section + ':' + related.slug"
            type="button"
            class="wiki-related-card"
            @click="$emit('open-wiki', [related.section, related.slug])"
          >
            <img v-if="related.imagePath" :src="related.imagePath" :alt="titleFor(related)" />
            <span>
              <strong>{{ titleFor(related) }}</strong>
              <small>{{ summaryFor(related) }}</small>
            </span>
          </button>
        </div>
      </section>
    </article>
  `
};
