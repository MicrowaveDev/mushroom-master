import { createApp, reactive, ref, computed, onMounted, watch } from 'vue/dist/vue.esm-bundler.js';
import './styles.css';

const messages = {
  ru: {
    title: 'Мицелиум: автобаттлер',
    authTitle: 'Вход в грибной бой',
    authBody: 'Мини-приложение поддерживает Telegram initData и браузерный вход через одноразовый код от бота.',
    authTelegram: 'Войти через Telegram',
    authBrowser: 'Войти через код бота',
    authDev: 'Локальная сессия',
    onboardingTitle: 'Первый запуск',
    onboardingBody: 'Выбери гриб, собери три артефакта в горизонтальном инвентаре 2x3 и отправь его в короткий 1v1 бой.',
    continue: 'Продолжить',
    save: 'Сохранить',
    startBattle: 'Начать бой',
    home: 'Домой',
    characters: 'Грибы',
    artifacts: 'Артефакты',
    battle: 'Бой',
    history: 'Реплеи',
    friends: 'Друзья',
    leaderboard: 'Рейтинг',
    wiki: 'Вики',
    profile: 'Прогресс',
    settings: 'Настройки',
    lab: 'AI Lab',
    active: 'Активный',
    selectedArtifacts: 'Выбранные артефакты',
    selectCell: 'Тапни на артефакт, чтобы сразу добавить его в контейнер справа',
    invalidLoadout: 'Нужно поставить ровно 3 разных артефакта без пересечений',
    artifactLimit: 'Можно поставить только 3 артефакта',
    equipped: 'В контейнере',
    battleLimit: 'Лимит боёв',
    language: 'Язык',
    reducedMotion: 'Меньше анимации',
    battleSpeed: 'Скорость боя',
    friendCode: 'Код друга',
    addFriend: 'Добавить',
    createChallenge: 'Бросить вызов',
    acceptChallenge: 'Принять вызов',
    declineChallenge: 'Отклонить',
    watchReplay: 'Смотреть реплей',
    results: 'Результат',
    reward: 'Награды',
    spore: 'Споры',
    mycelium: 'Мицелий',
    level: 'Уровень',
    localOnly: 'Только локально / dev',
    botCodeHint: 'Открой ссылку в боте и вернись сюда. Проверка идет автоматически.'
  },
  en: {
    title: 'Mycelium Autobattler',
    authTitle: 'Enter the mushroom arena',
    authBody: 'The Mini App supports Telegram initData and browser login through a one-time bot handoff.',
    authTelegram: 'Login with Telegram',
    authBrowser: 'Login with bot code',
    authDev: 'Local session',
    onboardingTitle: 'First launch',
    onboardingBody: 'Pick a mushroom, place three artifacts in a horizontal 2x3 inventory, and send it into a short 1v1 fight.',
    continue: 'Continue',
    save: 'Save',
    startBattle: 'Start battle',
    home: 'Home',
    characters: 'Mushrooms',
    artifacts: 'Artifacts',
    battle: 'Battle',
    history: 'Replays',
    friends: 'Friends',
    leaderboard: 'Leaderboard',
    wiki: 'Wiki',
    profile: 'Progress',
    settings: 'Settings',
    lab: 'AI Lab',
    active: 'Active',
    selectedArtifacts: 'Selected artifacts',
    selectCell: 'Tap an artifact to add it directly into the container on the right',
    invalidLoadout: 'You need exactly 3 unique artifacts with no overlap',
    artifactLimit: 'You can equip only 3 artifacts',
    equipped: 'Equipped',
    battleLimit: 'Battle limit',
    language: 'Language',
    reducedMotion: 'Reduced motion',
    battleSpeed: 'Battle speed',
    friendCode: 'Friend code',
    addFriend: 'Add',
    createChallenge: 'Challenge',
    acceptChallenge: 'Accept challenge',
    declineChallenge: 'Decline',
    watchReplay: 'Watch replay',
    results: 'Result',
    reward: 'Rewards',
    spore: 'Spore',
    mycelium: 'Mycelium',
    level: 'Level',
    localOnly: 'Local / dev only',
    botCodeHint: 'Open the bot link and return here. Verification polls automatically.'
  }
};

function parseStartParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    screen: params.get('screen'),
    challenge: params.get('challenge'),
    replay: params.get('replay')
  };
}

function setScreenQuery(screen, extra = {}) {
  const params = new URLSearchParams(window.location.search);
  params.set('screen', screen);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function apiHeaders(sessionKey) {
  return sessionKey
    ? {
        'Content-Type': 'application/json',
        'X-Session-Key': sessionKey
      }
    : { 'Content-Type': 'application/json' };
}

async function apiJson(path, options = {}, sessionKey = '') {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(sessionKey ? { 'X-Session-Key': sessionKey } : {})
    }
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}

function buildOccupancy(items) {
  const occupied = new Map();
  for (const item of items) {
    for (let dx = 0; dx < item.width; dx += 1) {
      for (let dy = 0; dy < item.height; dy += 1) {
        occupied.set(`${item.x + dx}:${item.y + dy}`, item.artifactId);
      }
    }
  }
  return occupied;
}

function deriveTotals(items, artifacts) {
  const byId = Object.fromEntries(artifacts.map((item) => [item.id, item]));
  return items.reduce(
    (acc, item) => {
      const artifact = byId[item.artifactId];
      if (!artifact) {
        return acc;
      }
      acc.damage += artifact.bonus.damage || 0;
      acc.armor += artifact.bonus.armor || 0;
      acc.speed += artifact.bonus.speed || 0;
      acc.stunChance += artifact.bonus.stunChance || 0;
      return acc;
    },
    { damage: 0, armor: 0, speed: 0, stunChance: 0 }
  );
}

const INVENTORY_COLUMNS = 3;
const INVENTORY_ROWS = 2;

function artifactTheme(artifact) {
  const themes = {
    damage: {
      shell: '#f5d59d',
      border: '#9d6130',
      accent: '#cc6b2c',
      ink: '#4f2f12',
      glow: 'rgba(255, 183, 112, 0.45)'
    },
    armor: {
      shell: '#d8e5cc',
      border: '#5f7c4f',
      accent: '#86a46d',
      ink: '#21351c',
      glow: 'rgba(148, 188, 138, 0.35)'
    },
    stun: {
      shell: '#dfe3b7',
      border: '#7a6f26',
      accent: '#c2a942',
      ink: '#393214',
      glow: 'rgba(233, 218, 129, 0.4)'
    }
  };
  return themes[artifact.family] || themes.damage;
}

function renderArtifactGlyph(artifact, theme) {
  switch (artifact.id) {
    case 'spore_needle':
      return `
        <ellipse cx="40" cy="24" rx="14" ry="10" fill="${theme.accent}" opacity="0.92" />
        <path d="M40 32 L46 74" stroke="${theme.ink}" stroke-width="8" stroke-linecap="round" />
        <path d="M32 40 L56 30" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" />
      `;
    case 'amber_fang':
      return `
        <path d="M42 10 C58 14 60 44 50 78 C46 86 38 86 34 78 C24 48 26 18 42 10 Z" fill="${theme.accent}" />
        <path d="M40 20 C44 32 45 48 42 68" stroke="${theme.shell}" stroke-width="5" stroke-linecap="round" opacity="0.78" />
      `;
    case 'glass_cap':
      return `
        <path d="M16 44 C22 24 42 14 64 14 C86 14 106 24 112 44 C104 56 84 60 64 60 C42 60 24 56 16 44 Z" fill="${theme.accent}" />
        <path d="M64 42 L64 62" stroke="${theme.ink}" stroke-width="8" stroke-linecap="round" />
        <path d="M34 36 C46 30 80 30 94 36" stroke="${theme.shell}" stroke-width="5" stroke-linecap="round" opacity="0.78" />
      `;
    case 'bark_plate':
      return `
        <rect x="18" y="18" width="44" height="44" rx="14" fill="${theme.accent}" />
        <path d="M30 22 C24 36 24 50 30 64" stroke="${theme.ink}" stroke-width="5" stroke-linecap="round" />
        <path d="M48 22 C54 36 54 50 48 62" stroke="${theme.border}" stroke-width="4" stroke-linecap="round" />
      `;
    case 'mycelium_wrap':
      return `
        <path d="M12 38 C24 24 42 22 60 32" stroke="${theme.shell}" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M68 32 C78 44 92 46 108 34" stroke="${theme.shell}" stroke-width="7" stroke-linecap="round" fill="none" />
        <circle cx="60" cy="38" r="8" fill="${theme.ink}" opacity="0.8" />
      `;
    case 'root_shell':
      return `
        <path d="M20 20 C32 12 48 12 60 20 C68 30 68 50 60 62 C48 72 32 72 20 62 C12 50 12 30 20 20 Z" fill="${theme.accent}" />
        <path d="M38 12 L38 70" stroke="${theme.border}" stroke-width="6" stroke-linecap="round" />
      `;
    case 'shock_puff':
      return `
        <path d="M22 52 C14 38 24 18 42 20 C50 10 68 12 72 28 C88 28 96 44 88 58 C80 70 60 74 42 70 C32 68 24 62 22 52 Z" fill="${theme.accent}" />
        <path d="M52 24 L42 44 H56 L46 64" stroke="${theme.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    case 'static_spore_sac':
      return `
        <path d="M42 12 C56 16 60 34 56 56 C52 70 48 78 46 84 C42 88 34 88 30 84 C22 58 24 24 42 12 Z" fill="${theme.accent}" />
        <path d="M40 22 L30 44 H42 L34 68" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <circle cx="50" cy="24" r="7" fill="${theme.shell}" opacity="0.88" />
      `;
    case 'thunder_gill':
      return `
        <path d="M14 40 C24 24 42 18 60 18 C80 18 98 24 106 40 C98 52 80 56 60 56 C40 56 22 52 14 40 Z" fill="${theme.accent}" />
        <path d="M42 28 L34 44 H48 L40 58" stroke="${theme.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path d="M68 28 L62 42 H74 L66 56" stroke="${theme.border}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    default:
      return `<rect x="18" y="18" width="44" height="44" rx="14" fill="${theme.accent}" />`;
  }
}

function renderArtifactFigure(artifact) {
  if (!artifact) {
    return '';
  }
  const theme = artifactTheme(artifact);
  const cells = Array.from({ length: artifact.width * artifact.height }, (_, index) => {
    const x = index % artifact.width;
    const y = Math.floor(index / artifact.width);
    return `
      <div class="artifact-figure-cell">
        <svg class="artifact-figure-svg" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="4" y="4" width="72" height="72" rx="20" fill="${theme.shell}" stroke="${theme.border}" stroke-width="6" />
          <rect x="10" y="10" width="60" height="60" rx="16" fill="${theme.glow}" opacity="0.8" />
          ${renderArtifactGlyph(artifact, theme, x, y)}
        </svg>
      </div>
    `;
  }).join('');
  return `
    <div
      class="artifact-figure-grid"
      style="grid-template-columns: repeat(${artifact.width}, minmax(0, 1fr)); grid-template-rows: repeat(${artifact.height}, minmax(0, 1fr));"
    >
      ${cells}
    </div>
  `;
}

const ArtifactGridBoard = {
  props: {
    columns: { type: Number, default: INVENTORY_COLUMNS },
    rows: { type: Number, default: INVENTORY_ROWS },
    items: { type: Array, default: () => [] },
    variant: { type: String, default: 'inventory' },
    renderArtifactFigure: { type: Function, required: true },
    getArtifact: { type: Function, required: true },
    interactiveCells: { type: Boolean, default: false },
    clickablePieces: { type: Boolean, default: false }
  },
  emits: ['cell-click', 'piece-click'],
  computed: {
    totalCells() {
      return this.columns * this.rows;
    },
    gridStyle() {
      return {
        gridTemplateColumns: `repeat(${this.columns}, var(--artifact-cell-size, 50px))`,
        gridTemplateRows: `repeat(${this.rows}, var(--artifact-cell-size, 50px))`
      };
    },
    rootClass() {
      return {
        'artifact-grid-board': true,
        'inventory-shell': this.variant === 'inventory',
        'artifact-grid-board--inventory': this.variant === 'inventory',
        'artifact-grid-board--catalog': this.variant === 'catalog'
      };
    }
  },
  methods: {
    cellX(index) {
      return index % this.columns;
    },
    cellY(index) {
      return Math.floor(index / this.columns);
    },
    pieceStyle(item) {
      return {
        gridColumn: `${item.x + 1} / span ${item.width}`,
        gridRow: `${item.y + 1} / span ${item.height}`
      };
    },
    backgroundClass() {
      return {
        'artifact-grid-background': true,
        inventory: this.variant === 'inventory'
      };
    },
    piecesClass() {
      return {
        'artifact-grid-pieces': true,
        'inventory-pieces': this.variant === 'inventory'
      };
    },
    cellClass() {
      return {
        'artifact-grid-cell': true,
        cell: this.variant === 'inventory',
        'artifact-grid-cell--interactive': this.interactiveCells
      };
    },
    clickCell(index) {
      if (!this.interactiveCells) {
        return;
      }
      this.$emit('cell-click', { x: this.cellX(index), y: this.cellY(index) });
    },
    clickPiece(item, event) {
      if (!this.clickablePieces) {
        return;
      }
      event.stopPropagation();
      this.$emit('piece-click', item);
    }
  },
  template: `
    <div :class="rootClass">
      <div :class="backgroundClass()" :style="gridStyle">
        <component
          :is="interactiveCells ? 'button' : 'span'"
          v-for="cell in totalCells"
          :key="cell"
          :class="cellClass()"
          :data-cell-x="cellX(cell - 1)"
          :data-cell-y="cellY(cell - 1)"
          @click="clickCell(cell - 1)"
        ></component>
      </div>
      <div :class="piecesClass()" :style="gridStyle">
        <component
          :is="clickablePieces ? 'button' : 'div'"
          v-for="item in items"
          :key="item.artifactId + ':' + item.x + ':' + item.y"
          class="artifact-piece"
          :class="{ mini: variant === 'catalog' }"
          :style="pieceStyle(item)"
          :data-artifact-id="item.artifactId"
          :title="getArtifact(item.artifactId)?.name?.ru || item.artifactId"
          @click="clickPiece(item, $event)"
          v-html="renderArtifactFigure(getArtifact(item.artifactId))"
        ></component>
      </div>
    </div>
  `
};

const App = {
  components: {
    ArtifactGridBoard
  },
  setup() {
    const state = reactive({
      sessionKey: localStorage.getItem('sessionKey') || '',
      bootstrap: null,
      appConfig: { localAiLabEnabled: false, localDevAuthEnabled: false },
      authCode: null,
      loading: true,
      error: '',
      screen: parseStartParams().screen || 'auth',
      lang: 'ru',
      selectedArtifactId: '',
      builderItems: [],
      currentBattle: null,
      replayIndex: 0,
      replayTimer: null,
      selectedWiki: null,
      wikiHome: null,
      friends: [],
      leaderboard: [],
      challenge: null,
      localLab: [],
      localLabInput: 'Round 1: Thalla uses Spore Lash, deals 8 damage, and stuns the target.'
    });

    const t = computed(() => messages[state.lang] || messages.ru);
    const isLocalLabEnabled = computed(() => state.appConfig.localAiLabEnabled);
    const isLocalDevAuthEnabled = computed(() => state.appConfig.localDevAuthEnabled);
    const activeEvent = computed(() => state.currentBattle?.events?.[state.replayIndex] || null);
    const visibleReplayEvents = computed(() => {
      if (!state.currentBattle?.events?.length) {
        return [];
      }
      return state.currentBattle.events
        .slice(0, state.replayIndex + 1)
        .map((event, index) => ({ ...event, replayIndex: index }))
        .reverse();
    });

    function applyTelegramTheme() {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        return;
      }
      tg.ready();
      tg.expand();
      const theme = tg.themeParams || {};
      const root = document.documentElement;
      root.style.setProperty('--telegram-accent', theme.button_color || '#7b5b3b');
      root.style.setProperty('--telegram-surface', theme.secondary_bg_color || '#f6f0df');
    }

    async function refreshBootstrap() {
      try {
        state.appConfig = await apiJson('/api/app-config');
      } catch (_error) {
        state.appConfig = { localAiLabEnabled: false, localDevAuthEnabled: false };
      }
      if (!state.sessionKey) {
        state.loading = false;
        return;
      }
      state.loading = true;
      try {
        state.bootstrap = await apiJson('/api/bootstrap', {}, state.sessionKey);
        state.lang = state.bootstrap.settings.lang;
        state.builderItems = state.bootstrap.loadout?.items ? [...state.bootstrap.loadout.items] : [];
        state.friends = await apiJson('/api/friends', {}, state.sessionKey);
        state.leaderboard = await apiJson('/api/leaderboard', {}, state.sessionKey);
        state.wikiHome = await apiJson('/api/wiki/home');
        if (!state.bootstrap.activeMushroomId) {
          state.screen = 'onboarding';
        } else if (state.screen === 'auth') {
          state.screen = 'home';
        }
      } catch (error) {
        state.error = error.message;
        state.bootstrap = null;
        state.friends = [];
        state.leaderboard = [];
        state.wikiHome = null;
        state.builderItems = [];
        state.screen = 'auth';
        localStorage.removeItem('sessionKey');
        state.sessionKey = '';
      } finally {
        state.loading = false;
      }
    }

    async function loginViaTelegram() {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        state.error = 'Missing Telegram initData';
        return;
      }
      const data = await apiJson('/api/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData })
      });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      await refreshBootstrap();
    }

    async function loginViaBrowserCode() {
      state.authCode = await apiJson('/api/auth/telegram/code', { method: 'POST' });
      const startedAt = Date.now();
      const poll = async () => {
        if (!state.authCode || Date.now() - startedAt > 10 * 60 * 1000) {
          state.error = 'Telegram auth timed out';
          return;
        }
        try {
          const result = await fetch('/api/auth/telegram/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ privateCode: state.authCode.privateCode })
          });
          const json = await result.json();
          if (json.success) {
            state.sessionKey = json.data.sessionKey;
            localStorage.setItem('sessionKey', json.data.sessionKey);
            state.authCode = null;
            await refreshBootstrap();
            return;
          }
        } catch (_error) {
        }
        window.setTimeout(poll, 3000);
      };
      window.open(state.authCode.botUrl, '_blank');
      poll();
    }

    async function loginViaDevSession() {
      state.error = '';
      const data = await apiJson('/api/dev/session', { method: 'POST', body: JSON.stringify({}) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      state.screen = 'home';
      await refreshBootstrap();
    }

    async function saveCharacter(mushroomId) {
      await apiJson(
        '/api/active-character',
        { method: 'PUT', body: JSON.stringify({ mushroomId }) },
        state.sessionKey
      );
      await refreshBootstrap();
      goTo('artifacts');
    }

    function goTo(screen, extra = {}) {
      state.screen = screen;
      setScreenQuery(screen, extra);
    }

    function getArtifact(artifactId) {
      return state.bootstrap?.artifacts?.find((item) => item.id === artifactId) || null;
    }

    function getMushroom(mushroomId) {
      return state.bootstrap?.mushrooms?.find((item) => item.id === mushroomId) || null;
    }

    function artifactGridStyle(item) {
      return {
        gridColumn: `${item.x + 1} / span ${item.width}`,
        gridRow: `${item.y + 1} / span ${item.height}`
      };
    }

    function normalizePlacement(artifact, x, y) {
      const candidate = {
        artifactId: artifact.id,
        x,
        y,
        width: artifact.width,
        height: artifact.height
      };
      const next = state.builderItems.filter((item) => item.artifactId !== artifact.id);
      const occupied = buildOccupancy(next);
      if (x + artifact.width > INVENTORY_COLUMNS || y + artifact.height > INVENTORY_ROWS) {
        return null;
      }
      for (let dx = 0; dx < artifact.width; dx += 1) {
        for (let dy = 0; dy < artifact.height; dy += 1) {
          if (occupied.has(`${x + dx}:${y + dy}`)) {
            return null;
          }
        }
      }
      next.push(candidate);
      return next.slice(0, 3);
    }

    function placeArtifact(x, y) {
      if (!state.selectedArtifactId || !state.bootstrap) {
        return false;
      }
      const artifact = state.bootstrap.artifacts.find((item) => item.id === state.selectedArtifactId);
      if (!artifact) {
        return false;
      }
      const next = normalizePlacement(artifact, x, y);
      if (!next) {
        state.error = t.value.invalidLoadout;
        return false;
      }
      state.builderItems = next;
      state.error = '';
      return true;
    }

    function autoPlaceArtifact(artifactId) {
      if (!state.bootstrap) {
        return;
      }
      const artifact = state.bootstrap.artifacts.find((item) => item.id === artifactId);
      if (!artifact) {
        return;
      }

      state.selectedArtifactId = artifactId;

      if (state.builderItems.some((item) => item.artifactId === artifactId)) {
        removeArtifact(artifactId);
        return;
      }

      if (state.builderItems.length >= 3) {
        state.error = t.value.artifactLimit;
        return;
      }

      for (let y = 0; y < INVENTORY_ROWS; y += 1) {
        for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
          const next = normalizePlacement(artifact, x, y);
          if (next) {
            state.builderItems = next;
            state.error = '';
            return;
          }
        }
      }

      state.error = t.value.invalidLoadout;
    }

    function removeArtifact(artifactId) {
      state.builderItems = state.builderItems.filter((item) => item.artifactId !== artifactId);
      if (state.selectedArtifactId === artifactId) {
        state.selectedArtifactId = '';
      }
    }

    async function saveLoadout() {
      if (!state.bootstrap?.activeMushroomId || state.builderItems.length !== 3) {
        state.error = t.value.invalidLoadout;
        return;
      }
      await apiJson(
        '/api/artifact-loadout',
        {
          method: 'PUT',
          body: JSON.stringify({
            mushroomId: state.bootstrap.activeMushroomId,
            items: state.builderItems
          })
        },
        state.sessionKey
      );
      await refreshBootstrap();
      goTo('battle');
    }

    async function startBattle() {
      try {
        state.error = '';
        state.currentBattle = await apiJson(
          '/api/battles',
          {
            method: 'POST',
            body: JSON.stringify({
              mode: 'ghost',
              idempotencyKey: crypto.randomUUID()
            })
          },
          state.sessionKey
        );
        state.replayIndex = 0;
        goTo('replay', { replay: state.currentBattle.id });
        autoplayReplay();
      } catch (error) {
        state.error = error.message || 'Could not start battle';
      }
    }

    function stopReplay() {
      if (state.replayTimer) {
        clearInterval(state.replayTimer);
        state.replayTimer = null;
      }
    }

    function autoplayReplay() {
      stopReplay();
      const delay = state.bootstrap?.settings?.battleSpeed === '2x' ? 600 : 1200;
      state.replayTimer = window.setInterval(() => {
        if (!state.currentBattle) {
          stopReplay();
          return;
        }
        if (state.replayIndex >= state.currentBattle.events.length - 1) {
          stopReplay();
          return;
        }
        state.replayIndex += 1;
      }, delay);
    }

    async function loadReplay(battleId) {
      state.currentBattle = await apiJson(`/api/battles/${battleId}`, {}, state.sessionKey);
      state.replayIndex = 0;
      goTo('replay', { replay: battleId });
      autoplayReplay();
    }

    async function saveSettings() {
      await apiJson(
        '/api/settings',
        {
          method: 'POST',
          body: JSON.stringify({
            lang: state.lang,
            reducedMotion: state.bootstrap.settings.reducedMotion,
            battleSpeed: state.bootstrap.settings.battleSpeed
          })
        },
        state.sessionKey
      );
      await refreshBootstrap();
    }

    async function addFriend(event) {
      const friendCode = event.target.friendCode.value.trim();
      state.friends = await apiJson(
        '/api/friends/add-by-code',
        { method: 'POST', body: JSON.stringify({ friendCode }) },
        state.sessionKey
      );
      event.target.reset();
    }

    async function challengeFriend(friendPlayerId) {
      state.challenge = await apiJson(
        '/api/friends/challenges',
        { method: 'POST', body: JSON.stringify({ friendPlayerId }) },
        state.sessionKey
      );
      goTo('friends', { challenge: state.challenge.id });
    }

    async function openChallenge(challengeId) {
      state.challenge = await apiJson(`/api/friends/challenges/${challengeId}`, {}, state.sessionKey);
      goTo('friends', { challenge: challengeId });
    }

    async function acceptChallenge() {
      if (!state.challenge) {
        return;
      }
      state.currentBattle = await apiJson(
        `/api/friends/challenges/${state.challenge.id}/accept`,
        { method: 'POST', body: JSON.stringify({}) },
        state.sessionKey
      );
      goTo('replay', { replay: state.currentBattle.id });
      autoplayReplay();
    }

    async function declineChallenge() {
      if (!state.challenge) {
        return;
      }
      state.challenge = await apiJson(
        `/api/friends/challenges/${state.challenge.id}/decline`,
        { method: 'POST', body: JSON.stringify({}) },
        state.sessionKey
      );
    }

    async function openWiki(section, slug) {
      state.selectedWiki = await apiJson(`/api/wiki/${section}/${slug}`);
      goTo('wiki-detail');
    }

    async function runLocalLab() {
      const results = await apiJson(
        '/api/local-tests/battle-narration',
        {
          method: 'POST',
          body: JSON.stringify({
            fixtureNarration: state.localLabInput,
            variants: [
              { name: 'compact-ru', model: 'gpt-4.1-mini', prompt: 'Сделай короткое боевое описание на русском.' },
              { name: 'dramatic-en', model: 'gpt-4.1-mini', prompt: 'Write a dramatic but compact English battle recap.' }
            ]
          })
        },
        state.sessionKey
      );
      state.localLab = results.results;
    }

      const activeMushroom = computed(() =>
        state.bootstrap?.mushrooms?.find((item) => item.id === state.bootstrap.activeMushroomId) || null
      );
    const builderTotals = computed(() => deriveTotals(state.builderItems, state.bootstrap?.artifacts || []));
    const activeReplayState = computed(() => activeEvent.value?.state || null);

    watch(
      () => state.lang,
      () => {
        document.documentElement.lang = state.lang;
      }
    );

    onMounted(async () => {
      applyTelegramTheme();
      await refreshBootstrap();
      const startParams = parseStartParams();
      if (startParams.challenge && state.sessionKey) {
        await openChallenge(startParams.challenge);
      }
      if (startParams.replay && state.sessionKey) {
        await loadReplay(startParams.replay);
      }
    });

    return {
      state,
      t,
      isLocalLabEnabled,
      isLocalDevAuthEnabled,
      activeMushroom,
      builderTotals,
      activeEvent,
      activeReplayState,
      visibleReplayEvents,
      goTo,
      loginViaTelegram,
      loginViaBrowserCode,
      loginViaDevSession,
      saveCharacter,
      getArtifact,
      getMushroom,
      artifactGridStyle,
      renderArtifactFigure,
      buildOccupancy,
      autoPlaceArtifact,
      placeArtifact,
      removeArtifact,
      saveLoadout,
      startBattle,
      loadReplay,
      stopReplay,
      autoplayReplay,
      saveSettings,
      addFriend,
      challengeFriend,
      openChallenge,
      acceptChallenge,
      declineChallenge,
      openWiki,
      runLocalLab
    };
  },
  template: `
    <div class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">{{ t.title }}</p>
          <h1>{{ t.title }}</h1>
        </div>
        <button class="ghost lang-toggle" @click="state.lang = state.lang === 'ru' ? 'en' : 'ru'">
          {{ state.lang.toUpperCase() }}
        </button>
      </header>

      <p v-if="state.error" class="error">{{ state.error }}</p>

      <section v-if="state.loading" class="panel">
        <h2>{{ t.authTitle }}</h2>
        <p>{{ t.authBody }}</p>
      </section>

      <section v-else-if="!state.sessionKey" class="panel stack">
        <h2>{{ t.authTitle }}</h2>
        <p>{{ t.authBody }}</p>
        <button class="primary" @click="loginViaTelegram">{{ t.authTelegram }}</button>
        <button class="secondary" @click="loginViaBrowserCode">{{ t.authBrowser }}</button>
        <button v-if="isLocalDevAuthEnabled" class="ghost" @click="loginViaDevSession">{{ t.authDev }}</button>
        <div v-if="state.authCode" class="note">
          <p>{{ t.botCodeHint }}</p>
          <a :href="state.authCode.botUrl" target="_blank">{{ state.authCode.botUrl }}</a>
        </div>
      </section>

      <template v-else-if="state.bootstrap">
        <nav class="nav-grid">
          <button class="nav-btn" @click="goTo('home')">{{ t.home }}</button>
          <button class="nav-btn" @click="goTo('characters')">{{ t.characters }}</button>
          <button class="nav-btn" @click="goTo('artifacts')">{{ t.artifacts }}</button>
          <button class="nav-btn" @click="goTo('battle')">{{ t.battle }}</button>
          <button class="nav-btn" @click="goTo('history')">{{ t.history }}</button>
          <button class="nav-btn" @click="goTo('friends')">{{ t.friends }}</button>
          <button class="nav-btn" @click="goTo('leaderboard')">{{ t.leaderboard }}</button>
          <button class="nav-btn" @click="goTo('wiki')">{{ t.wiki }}</button>
          <button class="nav-btn" @click="goTo('profile')">{{ t.profile }}</button>
          <button class="nav-btn" @click="goTo('settings')">{{ t.settings }}</button>
          <button v-if="isLocalLabEnabled" class="nav-btn" @click="goTo('lab')">{{ t.lab }}</button>
        </nav>

        <section v-if="state.screen === 'onboarding'" class="panel stack">
          <h2>{{ t.onboardingTitle }}</h2>
          <p>{{ t.onboardingBody }}</p>
          <button class="primary" @click="goTo('characters')">{{ t.continue }}</button>
        </section>

        <section v-else-if="state.screen === 'home'" class="dashboard">
          <article class="panel">
            <h2>{{ state.bootstrap.player.name }}</h2>
            <p>{{ t.spore }}: {{ state.bootstrap.player.spore }}</p>
            <p>Rating: {{ state.bootstrap.player.rating }}</p>
            <p>{{ t.battleLimit }}: {{ state.bootstrap.battleLimit.used }} / {{ state.bootstrap.battleLimit.limit }}</p>
          </article>
          <article class="panel" v-if="activeMushroom">
            <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="portrait"/>
            <h3>{{ activeMushroom.name[state.lang] }}</h3>
            <p>{{ t.active }}</p>
          </article>
          <article class="panel">
            <h3>{{ t.selectedArtifacts }}</h3>
            <artifact-grid-board
              v-if="state.builderItems.length"
              variant="inventory"
              class="inventory-shell home-inventory"
              :items="state.builderItems"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
            />
            <p v-else>{{ t.selectCell }}</p>
          </article>
        </section>

        <section v-else-if="state.screen === 'characters'" class="grid cards">
          <article class="panel card" v-for="mushroom in state.bootstrap.mushrooms" :key="mushroom.id">
            <img :src="mushroom.imagePath" :alt="mushroom.name[state.lang]" class="portrait"/>
            <h3>{{ mushroom.name[state.lang] }}</h3>
            <p>{{ mushroom.styleTag }}</p>
            <p>HP {{ mushroom.baseStats.health }} / ATK {{ mushroom.baseStats.attack }} / SPD {{ mushroom.baseStats.speed }}</p>
            <button class="primary" @click="saveCharacter(mushroom.id)">{{ t.save }}</button>
          </article>
        </section>

        <section v-else-if="state.screen === 'artifacts'" class="grid artifact-layout">
          <article class="panel">
            <h2>{{ t.artifacts }}</h2>
            <p>{{ t.selectCell }}</p>
            <div class="artifact-list">
              <button
                v-for="artifact in state.bootstrap.artifacts"
                :key="artifact.id"
                class="artifact-btn"
                :class="{
                  selected: state.selectedArtifactId === artifact.id,
                  placed: state.builderItems.some((item) => item.artifactId === artifact.id)
                }"
                @click="autoPlaceArtifact(artifact.id)"
                :data-artifact-id="artifact.id"
              >
                <artifact-grid-board
                  class="artifact-card-visual"
                  variant="catalog"
                  :columns="artifact.width"
                  :rows="artifact.height"
                  :items="[{ artifactId: artifact.id, x: 0, y: 0, width: artifact.width, height: artifact.height }]"
                  :render-artifact-figure="renderArtifactFigure"
                  :get-artifact="getArtifact"
                />
                <div class="artifact-card-copy">
                  <strong>{{ artifact.name[state.lang] }}</strong>
                  <small v-if="state.builderItems.some((item) => item.artifactId === artifact.id)" class="artifact-state">{{ t.equipped }}</small>
                  <span>{{ artifact.width }}x{{ artifact.height }}</span>
                </div>
              </button>
            </div>
          </article>
          <article class="panel">
            <artifact-grid-board
              variant="inventory"
              class="inventory-shell"
              :items="state.builderItems"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
              :interactive-cells="true"
              :clickable-pieces="true"
              @cell-click="placeArtifact($event.x, $event.y)"
              @piece-click="removeArtifact($event.artifactId)"
            />
            <p>ATK {{ builderTotals.damage }} / ARM {{ builderTotals.armor }} / SPD {{ builderTotals.speed }} / STUN {{ builderTotals.stunChance }}%</p>
            <button class="primary" @click="saveLoadout">{{ t.save }}</button>
          </article>
        </section>

        <section v-else-if="state.screen === 'battle'" class="panel stack battle-prep">
          <h2>{{ t.battle }}</h2>
          <p v-if="activeMushroom">{{ activeMushroom.name[state.lang] }} ready with {{ state.builderItems.length }} / 3 artifacts.</p>
          <div class="battle-prep-layout">
            <article class="panel battle-prep-character" v-if="activeMushroom">
              <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="portrait battle-prep-character-portrait"/>
              <h3>{{ activeMushroom.name[state.lang] }}</h3>
              <p>{{ activeMushroom.styleTag }}</p>
              <p>HP {{ activeMushroom.baseStats.health }} / ATK {{ activeMushroom.baseStats.attack }} / SPD {{ activeMushroom.baseStats.speed }}</p>
            </article>
            <div class="battle-prep-visual panel">
              <artifact-grid-board
                v-if="state.builderItems.length"
                variant="inventory"
                class="inventory-shell battle-prep-inventory"
                :items="state.builderItems"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
              />
              <p class="battle-prep-inventory-stats">ATK {{ builderTotals.damage }} / ARM {{ builderTotals.armor }} / SPD {{ builderTotals.speed }} / STUN {{ builderTotals.stunChance }}%</p>
            </div>
            <div class="battle-prep-summary panel stack">
              <button class="primary" :disabled="state.builderItems.length !== 3" @click="startBattle">{{ t.startBattle }}</button>
            </div>
          </div>
        </section>

        <section v-else-if="state.screen === 'replay' && state.currentBattle" class="grid replay-layout">
          <article class="panel battle-stage">
            <div class="duel">
              <div class="fighter" :class="{ acting: activeEvent?.actorSide === 'left' }">
                <img
                  v-if="getMushroom(state.currentBattle.snapshots.left.mushroomId)"
                  :src="getMushroom(state.currentBattle.snapshots.left.mushroomId).imagePath"
                  :alt="getMushroom(state.currentBattle.snapshots.left.mushroomId).name[state.lang]"
                  class="fighter-portrait"
                />
                <h3>{{ getMushroom(state.currentBattle.snapshots.left.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.left.mushroomId }}</h3>
                <p>{{ activeReplayState?.left.currentHealth }} / {{ activeReplayState?.left.maxHealth }}</p>
              </div>
              <div class="battle-status">
                <svg class="battle-status-icon" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M20 14 L30 24 L24 30 L14 20 Z" fill="#8a6135" />
                  <path d="M34 40 L44 50 L50 44 L40 34 Z" fill="#8a6135" />
                  <path d="M44 14 L50 20 L20 50 L14 44 Z" fill="#b07d47" />
                  <path d="M14 14 L20 20 L50 50 L44 44 Z" fill="#7f9872" />
                </svg>
                <p>{{ activeEvent?.narration }}</p>
              </div>
              <div class="fighter" :class="{ acting: activeEvent?.actorSide === 'right' }">
                <img
                  v-if="getMushroom(state.currentBattle.snapshots.right.mushroomId)"
                  :src="getMushroom(state.currentBattle.snapshots.right.mushroomId).imagePath"
                  :alt="getMushroom(state.currentBattle.snapshots.right.mushroomId).name[state.lang]"
                  class="fighter-portrait"
                />
                <h3>{{ getMushroom(state.currentBattle.snapshots.right.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.right.mushroomId }}</h3>
                <p>{{ activeReplayState?.right.currentHealth }} / {{ activeReplayState?.right.maxHealth }}</p>
              </div>
            </div>
            <div class="row">
              <button class="secondary" @click="stopReplay">Pause</button>
              <button class="secondary" @click="autoplayReplay">Play</button>
              <button class="ghost" @click="goTo('results')">{{ t.results }}</button>
            </div>
          </article>
          <article class="panel replay-log">
            <button
              v-for="event in visibleReplayEvents"
              :key="event.replayIndex"
              class="log-entry"
              :class="{ active: event.replayIndex === state.replayIndex }"
              @click="state.replayIndex = event.replayIndex"
            >
              {{ event.narration }}
            </button>
          </article>
        </section>

        <section v-else-if="state.screen === 'results' && state.currentBattle" class="panel stack">
          <h2>{{ t.results }}</h2>
          <p>{{ state.currentBattle.outcome }}</p>
          <div class="grid cards">
            <article class="panel card" v-for="(snapshot, side) in state.currentBattle.snapshots" :key="side">
              <img
                v-if="getMushroom(snapshot.mushroomId)"
                :src="getMushroom(snapshot.mushroomId).imagePath"
                :alt="getMushroom(snapshot.mushroomId).name[state.lang]"
                class="portrait results-portrait"
              />
              <h3>{{ getMushroom(snapshot.mushroomId)?.name[state.lang] || snapshot.mushroomId }}</h3>
              <artifact-grid-board
                variant="inventory"
                class="inventory-shell results-inventory"
                :items="snapshot.loadout.items"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
              />
            </article>
          </div>
          <div class="grid cards">
            <article class="panel card" v-for="reward in state.currentBattle.rewards" :key="reward.playerId + reward.mushroomId">
              <h3>{{ reward.mushroomId }}</h3>
              <p>{{ t.spore }} +{{ reward.sporeDelta }}</p>
              <p>{{ t.mycelium }} +{{ reward.myceliumDelta }}</p>
            </article>
          </div>
        </section>

        <section v-else-if="state.screen === 'history'" class="panel stack">
          <h2>{{ t.history }}</h2>
          <button
            v-for="battle in state.bootstrap.battleHistory"
            :key="battle.id"
            class="log-entry"
            @click="loadReplay(battle.id)"
          >
            {{ battle.id }} · {{ battle.mode }} · {{ battle.outcome }}
          </button>
        </section>

        <section v-else-if="state.screen === 'friends'" class="grid cards">
          <article class="panel">
            <h2>{{ t.friends }}</h2>
            <p>{{ t.friendCode }}: {{ state.bootstrap.player.friendCode }}</p>
            <form class="row" @submit.prevent="addFriend">
              <input name="friendCode" :placeholder="t.friendCode" />
              <button class="primary" type="submit">{{ t.addFriend }}</button>
            </form>
          </article>
          <article class="panel">
            <h3>Roster</h3>
            <button v-for="friend in state.friends" :key="friend.id" class="log-entry" @click="challengeFriend(friend.id)">
              {{ friend.name }} · {{ t.createChallenge }}
            </button>
          </article>
          <article class="panel" v-if="state.challenge">
            <h3>Challenge</h3>
            <p>{{ state.challenge.status }}</p>
            <button class="primary" @click="acceptChallenge">{{ t.acceptChallenge }}</button>
            <button class="secondary" @click="declineChallenge">{{ t.declineChallenge }}</button>
          </article>
        </section>

        <section v-else-if="state.screen === 'leaderboard'" class="panel stack">
          <h2>{{ t.leaderboard }}</h2>
          <div class="leaderboard-row" v-for="entry in state.leaderboard" :key="entry.id">
            <strong>#{{ entry.rank }}</strong>
            <span>{{ entry.name }}</span>
            <span>{{ entry.rating }}</span>
          </div>
        </section>

        <section v-else-if="state.screen === 'wiki'" class="grid cards">
          <article class="panel">
            <h2>{{ t.wiki }}</h2>
            <div class="stack">
              <button v-for="entry in state.wikiHome?.characters || []" :key="entry.slug" class="log-entry" @click="openWiki('characters', entry.slug)">
                {{ state.lang === 'ru' ? entry.titleRu : entry.titleEn }}
              </button>
            </div>
          </article>
          <article class="panel">
            <h3>Locations</h3>
            <button v-for="entry in state.wikiHome?.locations || []" :key="entry.slug" class="log-entry" @click="openWiki('locations', entry.slug)">
              {{ entry.titleRu }}
            </button>
          </article>
          <article class="panel">
            <h3>Factions</h3>
            <button v-for="entry in state.wikiHome?.factions || []" :key="entry.slug" class="log-entry" @click="openWiki('factions', entry.slug)">
              {{ entry.titleRu }}
            </button>
          </article>
        </section>

        <section v-else-if="state.screen === 'wiki-detail' && state.selectedWiki" class="panel stack">
          <button class="ghost" @click="goTo('wiki')">{{ t.wiki }}</button>
          <h2>{{ state.lang === 'ru' ? state.selectedWiki.title_ru : state.selectedWiki.title_en }}</h2>
          <img v-if="state.selectedWiki.image" :src="state.selectedWiki.image" :alt="state.selectedWiki.title_ru" class="portrait"/>
          <div v-html="state.selectedWiki.html"></div>
        </section>

        <section v-else-if="state.screen === 'profile'" class="grid cards">
          <article class="panel" v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId">
            <h3>{{ entry.mushroomId }}</h3>
            <p>{{ t.level }} {{ entry.level }}</p>
            <p>{{ t.mycelium }} {{ entry.mycelium }}</p>
          </article>
        </section>

        <section v-else-if="state.screen === 'settings'" class="panel stack">
          <h2>{{ t.settings }}</h2>
          <label class="setting-row">
            <span>{{ t.language }}</span>
            <select v-model="state.lang">
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label class="setting-row">
            <span>{{ t.reducedMotion }}</span>
            <input type="checkbox" v-model="state.bootstrap.settings.reducedMotion" />
          </label>
          <label class="setting-row">
            <span>{{ t.battleSpeed }}</span>
            <select v-model="state.bootstrap.settings.battleSpeed">
              <option value="1x">1x</option>
              <option value="2x">2x</option>
            </select>
          </label>
          <button class="primary" @click="saveSettings">{{ t.save }}</button>
        </section>

        <section v-else-if="state.screen === 'lab' && isLocalLabEnabled" class="panel stack">
          <h2>{{ t.lab }}</h2>
          <p>{{ t.localOnly }}</p>
          <textarea v-model="state.localLabInput" rows="6"></textarea>
          <button class="primary" @click="runLocalLab">Run</button>
          <article class="panel" v-for="result in state.localLab" :key="result.variant.name">
            <h3>{{ result.variant.name }}</h3>
            <p>{{ result.output }}</p>
          </article>
        </section>
      </template>

      <section v-else class="panel stack">
        <h2>{{ t.authTitle }}</h2>
        <p>{{ t.authBody }}</p>
      </section>
    </div>
  `
};

createApp(App).mount('#app');
