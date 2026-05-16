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
      authPortraits: AUTH_PORTRAITS,
      botCommandCopied: false
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
    },
    botStartCommand() {
      return this.state.authCode?.publicCode ? `/start auth-${this.state.authCode.publicCode}` : '';
    }
  },
  methods: {
    async copyBotStartCommand() {
      if (!this.botStartCommand) return;
      try {
        await navigator.clipboard?.writeText(this.botStartCommand);
        this.botCommandCopied = true;
        setTimeout(() => {
          this.botCommandCopied = false;
        }, 1800);
      } catch {
        this.botCommandCopied = false;
      }
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
          <button v-if="isLocalDevAuthEnabled" class="secondary" @click="$emit('login-browser')">{{ t.authBrowser }}</button>
          <button v-if="isLocalDevAuthEnabled" class="ghost" @click="$emit('login-dev')">{{ t.authDev }}</button>
        </div>
        <p v-if="isLocalDevAuthEnabled" class="auth-browser-note">{{ t.authBrowserNote }}</p>
        <div class="auth-lang-row">
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'ru' }" @click="state.lang = 'ru'">RU</button>
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'en' }" @click="state.lang = 'en'">EN</button>
        </div>
      </div>
      <div v-if="state.authCode" class="auth-code-modal" role="dialog" aria-modal="true" :aria-label="t.botCodeTitle">
        <div class="auth-code-backdrop" @click="$emit('cancel-telegram-code')"></div>
        <div class="auth-code-sheet panel">
          <button class="auth-code-close" type="button" :aria-label="t.botCodeCancel" @click="$emit('cancel-telegram-code')">×</button>
          <p class="eyebrow">{{ t.botCodeTitle }}</p>
          <p class="auth-code-hint">{{ t.botCodeHint }}</p>
          <a class="primary auth-code-open" :href="state.authCode.botUrl" target="_blank" rel="noopener noreferrer">{{ t.botCodeOpen }}</a>
          <div class="auth-code-command">
            <span>{{ t.botCodeCommandLabel }}</span>
            <code>{{ botStartCommand }}</code>
            <button class="ghost" type="button" @click="copyBotStartCommand">{{ botCommandCopied ? t.botCodeCopied : t.botCodeCopy }}</button>
          </div>
          <p class="muted">{{ t.botCodeWaiting }}</p>
          <button class="secondary" type="button" @click="$emit('cancel-telegram-code')">{{ t.botCodeCancel }}</button>
        </div>
      </div>
    </section>
  `
};
