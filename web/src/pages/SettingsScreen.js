export const SettingsScreen = {
  name: 'SettingsScreen',
  props: ['state', 't'],
  emits: ['save-settings'],
  template: `
    <section class="panel stack">
      <h2>{{ t.settings }}</h2>
      <label class="setting-row">
        <span>{{ t.language }}</span>
        <select v-model="state.lang"><option value="ru">RU</option><option value="en">EN</option></select>
      </label>
      <label class="setting-row">
        <span>{{ t.reducedMotion }}</span>
        <input type="checkbox" v-model="state.bootstrap.settings.reducedMotion" />
      </label>
      <label class="setting-row">
        <span>{{ t.battleSpeed }}</span>
        <select v-model="state.bootstrap.settings.battleSpeed"><option value="1x">1x</option><option value="2x">2x</option></select>
      </label>
      <button class="primary" @click="$emit('save-settings')">{{ t.save }}</button>
    </section>
  `
};
