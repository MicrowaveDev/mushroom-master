export const SettingsScreen = {
  name: 'SettingsScreen',
  props: ['state', 't'],
  emits: ['save-settings'],
  template: `
    <section class="panel settings-panel">
      <h2>{{ t.settings }}</h2>

      <label class="setting-row">
        <span class="setting-label">{{ t.language }}</span>
        <span class="setting-control">
          <select class="setting-select" v-model="state.lang">
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
        </span>
      </label>

      <label class="setting-row">
        <span class="setting-label">{{ t.reducedMotion }}</span>
        <span class="setting-toggle">
          <input type="checkbox" v-model="state.bootstrap.settings.reducedMotion" />
          <span class="setting-toggle-track"><span class="setting-toggle-thumb"></span></span>
        </span>
      </label>

      <label class="setting-row">
        <span class="setting-label">{{ t.battleSpeed }}</span>
        <span class="setting-control">
          <select class="setting-select" v-model="state.bootstrap.settings.battleSpeed">
            <option value="1x">1x</option>
            <option value="2x">2x</option>
          </select>
        </span>
      </label>

      <label class="setting-row">
        <span class="setting-label">{{ t.mobileActionsMode }}</span>
        <span class="setting-control">
          <select class="setting-select" v-model="state.mobileHomeActionsMode">
            <option value="auto">{{ t.mobileActionsAuto }}</option>
            <option value="always">{{ t.mobileActionsAlways }}</option>
            <option value="side">{{ t.mobileActionsSide }}</option>
            <option value="menu">{{ t.mobileActionsMenu }}</option>
          </select>
        </span>
      </label>

      <div class="setting-actions">
        <button class="primary setting-save" type="button" @click="$emit('save-settings')">{{ t.save }}</button>
      </div>
    </section>
  `
};
