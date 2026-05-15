import { replayPortraitConfig } from '../replay-portrait-config.js';

const AUTH_PORTRAITS = ['thalla', 'lomie', 'kirt'].map((mushroomId) => ({
  mushroomId,
  src: `/portraits/${mushroomId}/default.png`,
  objectPosition: replayPortraitConfig(mushroomId).imagePosition
}));

export const AuthScreen = {
  name: 'AuthScreen',
  props: ['state', 't', 'isLocalDevAuthEnabled'],
  emits: ['login-telegram', 'login-browser', 'login-dev', 'cancel-telegram-code'],
  data() {
    return {
      authPortraits: AUTH_PORTRAITS
    };
  },
  computed: {
    authFeature1() {
      const count = this.state.catalogCounts?.mushrooms || 0;
      return count > 0 ? this.t.authFeature1.replace('{count}', count) : this.t.authFeature1Fallback;
    },
    authFeature2() {
      const count = this.state.catalogCounts?.artifacts || 0;
      return count > 0 ? this.t.authFeature2.replace('{count}', count) : this.t.authFeature2Fallback;
    }
  },
  template: `
    <section class="auth-screen">
      <div class="auth-hero-card panel">
        <p class="eyebrow auth-eyebrow">{{ t.title }}</p>
        <div class="auth-portraits">
          <img
            v-for="portrait in authPortraits"
            :key="portrait.mushroomId"
            :src="portrait.src"
            :data-mushroom-id="portrait.mushroomId"
            :style="{ objectPosition: portrait.objectPosition }"
            alt=""
            class="auth-portrait"
          />
        </div>
        <h2 class="auth-title">{{ t.authTitle }}</h2>
        <p class="auth-tagline">{{ t.authTagline }}</p>
        <ul class="auth-features">
          <li>{{ authFeature1 }}</li>
          <li>{{ authFeature2 }}</li>
          <li>{{ t.authFeature3 }}</li>
        </ul>
        <div class="auth-actions">
          <button class="primary auth-cta" @click="$emit('login-telegram')">{{ t.authTelegram }}</button>
          <button class="secondary" @click="$emit('login-browser')">{{ t.authBrowser }}</button>
          <button v-if="isLocalDevAuthEnabled" class="ghost" @click="$emit('login-dev')">{{ t.authDev }}</button>
        </div>
        <p class="auth-browser-note">{{ t.authBrowserNote }}</p>
        <div v-if="state.authCode" class="note">
          <p><strong>{{ t.botCodeTitle }}</strong></p>
          <p>{{ t.botCodeHint }}</p>
          <a :href="state.authCode.botUrl" target="_blank" rel="noopener noreferrer">{{ t.botCodeOpen }}</a>
          <p class="muted">{{ t.botCodeWaiting }}</p>
          <button class="ghost" @click="$emit('cancel-telegram-code')">{{ t.botCodeCancel }}</button>
        </div>
        <div class="auth-lang-row">
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'ru' }" @click="state.lang = 'ru'">RU</button>
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'en' }" @click="state.lang = 'en'">EN</button>
        </div>
      </div>
    </section>
  `
};
