import { AuthScreen as CoreAuthScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { replayPortraitConfig } from '../replay-portrait-config.js';

const portraits = ['thalla', 'lomie', 'kirt'].map((id) => ({
  id,
  src: `/portraits/${id}/default.png`,
  objectPosition: replayPortraitConfig(id).imagePosition
}));

export const AuthScreen = {
  name: 'MushroomAuthScreen',
  components: { CoreAuthScreen },
  props: ['state', 't', 'isLocalDevAuthEnabled'],
  emits: ['login-telegram', 'login-browser', 'login-dev', 'cancel-telegram-code'],
  computed: {
    labels() {
      return {
        productTitle: this.t.title,
        title: this.t.authTitle,
        tagline: this.t.authTagline,
        feature1: this.t.authFeature1,
        feature1Fallback: this.t.authFeature1Fallback,
        feature2: this.t.authFeature2,
        feature2Fallback: this.t.authFeature2Fallback,
        feature3: this.t.authFeature3,
        primaryLogin: this.t.authTelegram,
        browser: this.t.authBrowser,
        dev: this.t.authDev,
        browserNote: this.t.authBrowserNote,
        codeTitle: this.t.botCodeTitle,
        codeHint: this.t.botCodeHint,
        codeOpen: this.t.botCodeOpen,
        codeCommandLabel: this.t.botCodeCommandLabel,
        codeCopied: this.t.botCodeCopied,
        codeCopy: this.t.botCodeCopy,
        codeWaiting: this.t.botCodeWaiting,
        codeCancel: this.t.botCodeCancel
      };
    },
    counts() {
      return {
        characters: this.state.catalogCounts?.mushrooms || 0,
        artifacts: this.state.catalogCounts?.artifacts || 0
      };
    }
  },
  methods: {
    updateLocale(locale) {
      this.state.lang = locale;
    }
  },
  template: `
    <core-auth-screen
      :portraits="portraits"
      :locale="state.lang"
      :labels="labels"
      :catalog-counts="counts"
      :auth-code="state.authCode"
      :dev-auth-enabled="isLocalDevAuthEnabled"
      portrait-data-attribute="data-mushroom-id"
      @update:locale="updateLocale"
      @login-primary="$emit('login-telegram')"
      @login-browser="$emit('login-browser')"
      @login-dev="$emit('login-dev')"
      @cancel-auth-code="$emit('cancel-telegram-code')"
    />
  `,
  data() {
    return { portraits };
  }
};
