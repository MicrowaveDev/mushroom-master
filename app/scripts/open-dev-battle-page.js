import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer';

const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:3021';
const headless = ['1', 'true', 'yes'].includes(String(process.env.HEADLESS || '').toLowerCase());
const autoStart = ['1', 'true', 'yes'].includes(String(process.env.START_BATTLE || '').toLowerCase());

const defaultSetup = {
  telegramId: 990001,
  username: 'dev_battle_page',
  name: 'Dev Battle',
  mushroomId: 'thalla',
  artifacts: [
    { id: 'spore_needle', cell: 1 },
    { id: 'root_shell', cell: 2 },
    { id: 'shock_puff', cell: 4 }
  ],
  ghostOpponent: {
    telegramId: 990002,
    username: 'dev_battle_ghost',
    name: 'Dev Ghost',
    mushroomId: 'kirt',
    artifacts: [
      { id: 'amber_fang', cell: 1 },
      { id: 'bark_plate', cell: 2 },
      { id: 'thunder_gill', cell: 3 }
    ]
  }
};

const mushroomLabels = {
  thalla: ['Тхалла', 'Thalla'],
  lomie: ['Ломиэ', 'Lomie'],
  axilin: ['Аксилин', 'Axilin'],
  kirt: ['Кирт', 'Kirt'],
  morga: ['Морга', 'Morga']
};

const artifactLabels = {
  spore_needle: ['Споровая Игла', 'Spore Needle'],
  amber_fang: ['Янтарный Клык', 'Amber Fang'],
  glass_cap: ['Стеклянная Шляпка', 'Glass Cap'],
  bark_plate: ['Кора-Пластина', 'Bark Plate'],
  mycelium_wrap: ['Мицелиевый Пояс', 'Mycelium Wrap'],
  root_shell: ['Корневой Панцирь', 'Root Shell'],
  shock_puff: ['Шоковая Пышка', 'Shock Puff'],
  static_spore_sac: ['Статический Споровый Мешок', 'Static Spore Sac'],
  thunder_gill: ['Громовая Пластина', 'Thunder Gill']
};

function parseArgs(argv) {
  const config = { ...defaultSetup };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--mushroom' && argv[index + 1]) {
      config.mushroomId = argv[index + 1];
      index += 1;
    }
    if (value === '--start') {
      config.startBattle = true;
    }
    if (value === '--headless') {
      config.headless = true;
    }
    if (value === '--help') {
      config.help = true;
    }
  }
  return config;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`
Usage:
  npm run game:dev:battle-page -- [--mushroom thalla] [--start] [--headless]

Behavior:
  - requires the dev server to already be running
  - creates a dev session through /api/dev/session
  - opens the app
  - selects a mushroom
  - places three artifacts in the container UI
  - saves the loadout
  - lands on the battle-prep screen
  - optionally clicks Start Battle when --start or START_BATTLE=1 is set
`);
}

async function ensureServer() {
  const response = await fetch(`${baseUrl}/api/health`).catch(() => null);
  if (!response?.ok) {
    throw new Error(`Dev server is not reachable at ${baseUrl}. Start it with: npm run game:start`);
  }
}

async function createDevSession(payload = {}) {
  const response = await fetch(`${baseUrl}/api/dev/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramId: payload.telegramId || defaultSetup.telegramId,
      username: payload.username || defaultSetup.username,
      name: payload.name || defaultSetup.name
    })
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`Could not create dev session: ${json.error || 'unknown error'}`);
  }
  return json.data;
}

async function api(sessionKey, url, method = 'GET', data = undefined) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Key': sessionKey
    },
    body: data ? JSON.stringify(data) : undefined
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`API failed for ${url}: ${json.error || 'unknown error'}`);
  }
  return json.data;
}

async function seedGhostOpponent() {
  const ghost = await createDevSession(defaultSetup.ghostOpponent);
  await api(ghost.sessionKey, '/api/active-character', 'PUT', {
    mushroomId: defaultSetup.ghostOpponent.mushroomId
  });
  await api(ghost.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: defaultSetup.ghostOpponent.mushroomId,
    items: defaultSetup.ghostOpponent.artifacts.map((artifact) => {
      const mapping = {
        amber_fang: { x: 0, y: 0, width: 1, height: 2 },
        bark_plate: { x: 1, y: 0, width: 1, height: 1 },
        thunder_gill: { x: 2, y: 0, width: 2, height: 1 }
      };
      return {
        artifactId: artifact.id,
        ...mapping[artifact.id]
      };
    })
  });
  return ghost;
}

async function chooseMushroom(page, mushroomId) {
  await page.goto(`${baseUrl}?screen=characters`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  const labels = mushroomLabels[mushroomId] || [mushroomId];
  for (const label of labels) {
    const card = page.locator('.card').filter({ hasText: label }).first();
    if (await card.count()) {
      await card.getByRole('button').click();
      return;
    }
  }
  throw new Error(`Could not find mushroom card for "${mushroomId}"`);
}

async function placeArtifacts(page, artifacts) {
  await page.goto(`${baseUrl}?screen=artifacts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.board');

  for (const artifact of artifacts) {
    const labels = artifactLabels[artifact.id] || [artifact.id];
    let clicked = false;
    for (const label of labels) {
      const button = page.locator('.artifact-btn').filter({ hasText: label }).first();
      if (await button.count()) {
        await button.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      throw new Error(`Could not find artifact button for "${artifact.id}"`);
    }
    await page.locator('.cell').nth(artifact.cell - 1).click();
  }

  await page.getByRole('button', { name: /save|сохранить/i }).click();
}

async function run() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  await ensureServer();
  const session = await createDevSession();
  await seedGhostOpponent();
  const browser = await chromium.launch({
    headless: cli.headless || headless,
    executablePath: puppeteer.executablePath()
  });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 }
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, session.sessionKey);

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await chooseMushroom(page, cli.mushroomId);
  await placeArtifacts(page, defaultSetup.artifacts);
  await page.waitForURL(/screen=battle/);
  await page.waitForSelector('button');

  if (cli.startBattle || autoStart) {
    await page.getByRole('button', { name: /start battle|начать бой/i }).click();
    await page.waitForURL(/screen=replay/);
  }

  // eslint-disable-next-line no-console
  console.log(`Opened dev battle page at ${page.url()}`);
  // eslint-disable-next-line no-console
  console.log('Browser stays open so you can inspect or continue manually.');
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exitCode = 1;
});
