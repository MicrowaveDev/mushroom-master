import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../app/shared/repo-root.js';
import { encodeDeterministicPng } from '../../app/scripts/lib/bitmap-image-toolkit.js';
import {
  buildPlaywrightArgs,
  buildPlaywrightEnv,
  parsePlaywrightRunnerArgs
} from '../../app/scripts/runners/run-game-playwright.js';
import { previewConfig } from '../../app/scripts/runners/run-home-field-preview.js';
import { buildHomeFieldStatus } from '../../app/shared/home-field/home-field-status.js';

test('[scripts] deprecated generators and one-off runners stay removed', () => {
  const removed = [
    'app/scripts/generate-artifact-bitmaps.js',
    'app/scripts/polish-home-field-minimal-candidate.js',
    'app/scripts/home-field-chibi-proof-context.js',
    'app/scripts/home-field-status.js',
    'app/scripts/run-game-e2e.js',
    'app/scripts/run-game-screenshot-check.js'
  ];
  for (const relativePath of removed) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), false, relativePath);
  }

  const scripts = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['game:artifacts:generate'], undefined);
  assert.equal(scripts['game:home-field:polish-minimal-candidate'], undefined);
  assert.equal(scripts['game:home-field:chibi-proof-context'], undefined);
  assert.equal(scripts['game:test:e2e'], 'node app/scripts/runners/run-game-playwright.js --suite=e2e');
  assert.equal(scripts['game:test:screens'], 'node app/scripts/runners/run-game-playwright.js --suite=screens');
});

test('[scripts] artifact rendering helper remains available to the web UI', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'web/src/artifacts/render.js')), true);
});

test('[scripts] entry points are grouped by responsibility', () => {
  const scriptsRoot = path.join(repoRoot, 'app/scripts');
  const rootEntries = fs.readdirSync(scriptsRoot, { withFileTypes: true });
  const rootFiles = rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const directories = rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  assert.deepEqual(rootFiles, ['README.md', 'command-manifest.json']);
  assert.deepEqual(directories, ['checks', 'generation', 'lib', 'operations', 'runners', 'workflows']);
});

test('[scripts] Playwright runner builds suite arguments and isolated environment', () => {
  assert.deepEqual(parsePlaywrightRunnerArgs(['--suite=screens', '--debug']), {
    suite: 'screens',
    debug: true,
    help: false
  });
  assert.equal(parsePlaywrightRunnerArgs(['--help']).help, true);
  assert.throws(() => parsePlaywrightRunnerArgs(['--suite=unknown']), /Unknown Playwright suite/);
  assert.deepEqual(buildPlaywrightArgs({ suite: 'e2e' }), [
    'playwright',
    'test',
    '--config=tests/game/playwright.config.js',
    '--reporter=line'
  ]);
  const env = buildPlaywrightEnv({ suite: 'screens', debug: true, backendPort: 4101, frontendPort: 4102 }, {});
  assert.equal(env.PLAYWRIGHT_TEST_BACKEND_PORT, '4101');
  assert.equal(env.PLAYWRIGHT_TEST_FRONTEND_PORT, '4102');
  assert.equal(env.PLAYWRIGHT_SCREEN_DEBUG, '1');
  assert.equal(env.VITE_REPLAY_AUTOPLAY_MS, '320');
});

test('[scripts] Home Field preview scopes resolve through one runner', () => {
  const objects = previewConfig(['--scope=objects'], {});
  assert.equal(objects.scope, 'objects');
  assert.equal(objects.help, false);
  assert.match(objects.env.HOME_FIELD_CANDIDATE_ROOT, /object-layer\/latest$/);
  const combined = previewConfig(['--scope=combined'], {});
  assert.match(combined.env.HOME_FIELD_CANDIDATE_ROOTS, /grass-family/);
  assert.equal(previewConfig(['--help'], {}).help, true);
  assert.throws(() => previewConfig(['--scope=unknown'], {}), /Unknown preview scope/);
});

test('[scripts] Home Field status does not treat existence as production readiness', () => {
  const assetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'home-field-status-'));
  const outputPath = 'web/public/home-field/test.png';
  const absolutePath = path.join(assetRoot, outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, encodeDeterministicPng({ width: 2, height: 2, rgba: Buffer.alloc(16, 255) }));
  const assetsDoc = {
    assets: [{ id: 'test', type: 'terrain', outputPath, width: 2, height: 2, status: 'approved' }],
    characters: []
  };
  try {
    const needsReview = buildHomeFieldStatus({ assetsDoc, reviewDoc: { assets: [] }, queueDoc: { items: [] }, assetRoot });
    assert.equal(needsReview.entries[0].state, 'needs_review');
    assert.equal(needsReview.allProductionReady, false);

    const reviewDoc = { assets: [{ id: 'test', verdict: 'approved', accepted: true }] };
    const ready = buildHomeFieldStatus({ assetsDoc, reviewDoc, queueDoc: { items: [] }, assetRoot });
    assert.equal(ready.entries[0].state, 'production_ready');

    const blocked = buildHomeFieldStatus({
      assetsDoc,
      reviewDoc,
      queueDoc: { items: [{ id: 'queue-test', assetId: 'test', sourceGate: { status: 'blocked_failed' } }] },
      assetRoot
    });
    assert.equal(blocked.entries[0].state, 'approved');
    assert.equal(blocked.entries[0].productionReady, false);
  } finally {
    fs.rmSync(assetRoot, { recursive: true, force: true });
  }
});

test('[scripts] placeholder generator is isolated from production assets', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'app/scripts/generation/generate-home-field-placeholder-tiles.js'), 'utf8');
  assert.match(source, /home-field-workspace', 'raw'/);
  assert.match(source, /productionEligible: false/);
  assert.doesNotMatch(source, /web', 'public', 'home-field/);
});

test('[scripts] documentation and manifest cover the supported command surface', () => {
  const result = spawnSync('npm', ['run', '--silent', 'scripts:docs:check'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Script documentation OK: 76 commands in 9 families and 6 directories/);
});
