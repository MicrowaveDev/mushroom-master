export const AuthScreen = {
  name: 'AuthScreen',
  props: ['state', 't', 'isLocalDevAuthEnabled'],
  emits: ['login-telegram', 'login-browser', 'login-dev'],
  template: `
    <section class="auth-screen">
      <div class="auth-hero-card panel">
        <p class="eyebrow auth-eyebrow">{{ t.title }}</p>
        <div class="auth-portraits">
          <img src="/data/channel/assets/2026-03-27T23-32-46-000Z-53.bin.jpg" alt="" class="auth-portrait" />
          <img src="/data/channel/assets/2026-03-28T02-06-35-000Z-214.bin.jpg" alt="" class="auth-portrait" />
          <img src="/data/channel/assets/2026-03-28T02-06-16-000Z-212.bin.jpg" alt="" class="auth-portrait" />
        </div>
        <h2 class="auth-title">{{ t.authTitle }}</h2>
        <p class="auth-tagline">{{ t.authTagline }}</p>
        <ul class="auth-features">
          <li>{{ t.authFeature1 }}</li>
          <li>{{ t.authFeature2 }}</li>
          <li>{{ t.authFeature3 }}</li>
        </ul>
        <div class="auth-actions">
          <button class="primary auth-cta" @click="$emit('login-telegram')">{{ t.authTelegram }}</button>
          <button class="secondary" @click="$emit('login-browser')">{{ t.authBrowser }}</button>
          <button v-if="isLocalDevAuthEnabled" class="ghost" @click="$emit('login-dev')">{{ t.authDev }}</button>
        </div>
        <div v-if="state.authCode" class="note">
          <p>{{ t.botCodeHint }}</p>
          <a :href="state.authCode.botUrl" target="_blank">{{ state.authCode.botUrl }}</a>
        </div>
        <div class="auth-lang-row">
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'ru' }" @click="state.lang = 'ru'">RU</button>
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'en' }" @click="state.lang = 'en'">EN</button>
        </div>
      </div>
    </section>
  `
};
