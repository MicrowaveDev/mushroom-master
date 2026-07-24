import { HomeScreen as CoreHomeScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { getNextRunAchievementHint, getRunAchievementsByIds } from '../../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../../app/shared/season-levels.js';
import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { buildFriendInviteLink, shareTelegramText } from '../helpers/telegram-links.js';

function normalizeProgression(progression = {}) {
  return Object.fromEntries(Object.entries(progression).map(([id, entry]) => [
    id,
    {
      ...entry,
      characterId: entry.characterId || entry.mushroomId || id,
      progressionCurrency: entry.progressionCurrency ?? entry.mycelium ?? 0,
      currentLevelProgressionCurrency: entry.currentLevelProgressionCurrency ?? entry.currentLevelMycelium ?? 0,
      nextLevelProgressionCurrency: entry.nextLevelProgressionCurrency ?? entry.nextLevelMycelium ?? null
    }
  ]));
}

export const HomeScreen = {
  name: 'HomeScreen',
  components: { CoreHomeScreen },
  props: [
    'state', 't', 'activeMushroom', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'getMushroom',
    'describeRun', 'formatDelta', 'formatArtifactBonus', 'portraitPosition', 'portraitPositionFor'
  ],
  emits: [
    'resume-run', 'start-run', 'abandon-run',
    'load-run-summary', 'go',
    'add-friend', 'challenge-friend',
    'accept-challenge', 'decline-challenge',
    'select-mushroom',
    'switch-portrait', 'purchase-portrait', 'switch-preset',
    'roll-asset-pack', 'burn-asset-pack', 'load-wallet-bundles', 'purchase-wallet'
  ],
  data() {
    return {
      homeAdapters: {
        getSeasonProgressSummary,
        getRunAchievementsByIds,
        getNextRunAchievementHint,
        buildFriendInviteLink,
        shareTelegramText,
        artifactFusionRecipes
      }
    };
  },
  computed: {
    normalizedState() {
      const source = this.state;
      const bootstrap = source.bootstrap || {};
      const normalizedBootstrap = {
        ...bootstrap,
        characters: bootstrap.characters || bootstrap.mushrooms || [],
        activeCharacterId: bootstrap.activeCharacterId || bootstrap.activeMushroomId || null,
        progression: normalizeProgression(bootstrap.progression),
        activeGameRuns: (bootstrap.activeGameRuns || []).map((run) => ({
          ...run,
          characterId: run.characterId || run.mushroomId
        }))
      };
      return new Proxy(source, {
        get(target, key) {
          return key === 'bootstrap' ? normalizedBootstrap : target[key];
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        }
      });
    },
    normalizedText() {
      return {
        ...this.t,
        progressionCurrency: this.t.progressionCurrency || this.t.mycelium,
        profileCurrency: this.t.profileCurrency || this.t.spore
      };
    }
  },
  methods: {
    resolveWalletSurface() {
      return globalThis.Telegram?.WebApp ? 'telegram_mini_app' : 'web';
    }
  },
  template: `
    <CoreHomeScreen
      :state="normalizedState"
      :t="normalizedText"
      :active-character="activeMushroom"
      :builder-totals="builderTotals"
      :render-artifact-figure="renderArtifactFigure"
      :get-artifact="getArtifact"
      :get-character="getMushroom"
      :describe-run="describeRun"
      :format-delta="formatDelta"
      :format-artifact-bonus="formatArtifactBonus"
      :portrait-position="portraitPosition"
      :portrait-position-for="portraitPositionFor"
      :get-season-progress-summary="homeAdapters.getSeasonProgressSummary"
      :get-achievements-by-ids="homeAdapters.getRunAchievementsByIds"
      :get-next-achievement-hint="homeAdapters.getNextRunAchievementHint"
      :resolve-wallet-surface="resolveWalletSurface"
      :build-invite-link="homeAdapters.buildFriendInviteLink"
      :share-invite-value="homeAdapters.shareTelegramText"
      :fusion-recipes="homeAdapters.artifactFusionRecipes"
      progression-currency-icon="🍄"
      @resume-run="$emit('resume-run')"
      @start-run="$emit('start-run', $event)"
      @abandon-run="$emit('abandon-run')"
      @load-run-summary="$emit('load-run-summary', $event)"
      @go="$emit('go', $event)"
      @add-friend="$emit('add-friend', $event)"
      @challenge-friend="$emit('challenge-friend', $event)"
      @accept-challenge="$emit('accept-challenge')"
      @decline-challenge="$emit('decline-challenge')"
      @select-character="$emit('select-mushroom', $event)"
      @switch-portrait="$emit('switch-portrait', $event)"
      @purchase-portrait="$emit('purchase-portrait', $event)"
      @switch-preset="$emit('switch-preset', $event)"
      @roll-asset-pack="$emit('roll-asset-pack', $event)"
      @burn-asset-pack="$emit('burn-asset-pack', $event)"
      @load-wallet-bundles="$emit('load-wallet-bundles', $event)"
      @purchase-wallet="$emit('purchase-wallet', $event)"
    />
  `
};
