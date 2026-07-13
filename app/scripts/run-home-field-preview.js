import { spawn } from 'node:child_process';
import { repoRoot } from '../shared/repo-root.js';

export const HOME_FIELD_PREVIEW_SCOPES = Object.freeze({
  grass: {
    root: '.agent/home-field-workspace/candidates/grass-family/latest',
    ids: 'grass_base_01,grass_base_02,grass_flowers_01'
  },
  terrain: {
    root: '.agent/home-field-workspace/candidates/terrain-family/latest',
    ids: 'path_h_end_w,path_dirt_straight,path_spore_glow,path_h_end_e,path_destination_row'
  },
  objects: {
    root: '.agent/home-field-workspace/candidates/object-layer/latest',
    ids: 'bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01'
  },
  chibi: {
    root: '.agent/home-field-workspace/candidates/chibi-active-roster/latest',
    ids: 'thalla'
  },
  combined: {
    roots: [
      '.agent/home-field-workspace/candidates/grass-family/latest',
      '.agent/home-field-workspace/candidates/terrain-family/latest',
      '.agent/home-field-workspace/candidates/object-layer/latest',
      '.agent/home-field-workspace/candidates/chibi-active-roster/latest'
    ],
    ids: 'grass_base_01,grass_base_02,grass_flowers_01,path_h_end_w,path_dirt_straight,path_spore_glow,path_h_end_e,path_destination_row,bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01,mushroom_cluster_small_amber,mushroom_cluster_small_violet,mushroom_cap_red_spotted,fallen_branch_mycelium,arena_mushroom_arch,journey_gate_under_construction,thalla'
  }
});

export const HOME_FIELD_PREVIEW_USAGE = `Usage: node app/scripts/run-home-field-preview.js [options]

Options:
  --scope=grass|terrain|objects|chibi|combined  Select candidate assets (default: grass)
  --help, -h                                    Show this help`;

export function previewConfig(argv, env = process.env) {
  const scope = argv.find((arg) => arg.startsWith('--scope='))?.slice('--scope='.length) || 'grass';
  const defaults = HOME_FIELD_PREVIEW_SCOPES[scope];
  if (!defaults) throw new Error(`Unknown preview scope "${scope}". Expected: ${Object.keys(HOME_FIELD_PREVIEW_SCOPES).join(', ')}`);
  return {
    scope,
    help: argv.includes('--help') || argv.includes('-h'),
    env: {
      ...env,
      HOME_FIELD_CANDIDATE_PREVIEW: '1',
      HOME_FIELD_CANDIDATE_IDS: env.HOME_FIELD_CANDIDATE_IDS || defaults.ids,
      ...(defaults.roots
        ? { HOME_FIELD_CANDIDATE_ROOTS: env.HOME_FIELD_CANDIDATE_ROOTS || defaults.roots.join(',') }
        : { HOME_FIELD_CANDIDATE_ROOT: env.HOME_FIELD_CANDIDATE_ROOT || defaults.root })
    }
  };
}

export function runHomeFieldPreview(argv = process.argv.slice(2)) {
  const config = previewConfig(argv);
  if (config.help) {
    console.log(HOME_FIELD_PREVIEW_USAGE);
    return;
  }
  console.log(`[game:home-field:preview] scope=${config.scope}`);
  const child = spawn('npx', [
    'playwright',
    'test',
    '--config=tests/game/playwright.config.js',
    'tests/game/home-field-candidate-preview.spec.js',
    '--reporter=line'
  ], { cwd: repoRoot, stdio: 'inherit', env: config.env });
  child.on('exit', (code, signal) => {
    if (signal) return process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

if (process.argv[1]?.endsWith('run-home-field-preview.js')) {
  try {
    runHomeFieldPreview();
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
