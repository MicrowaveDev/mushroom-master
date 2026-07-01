import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

export function checkBackpackGameCoreSubmodule({ root = repoRoot } = {}) {
  const coreDir = path.join(root, 'vendor', 'backpack-game-core');
  const packagePath = path.join(coreDir, 'package.json');
  const indexPath = path.join(coreDir, 'src', 'index.js');
  const gitPath = path.join(coreDir, '.git');

  const missing = [];
  for (const entry of [
    ['core package.json', packagePath],
    ['core src/index.js', indexPath],
    ['core git metadata', gitPath]
  ]) {
    if (!fs.existsSync(entry[1])) {
      missing.push(entry[0]);
    }
  }

  if (missing.length) {
    throw new Error(
      [
        `backpack-game-core submodule is not initialized at ${path.relative(root, coreDir)}.`,
        `Missing: ${missing.join(', ')}.`,
        'Run: git submodule update --init --recursive'
      ].join(' ')
    );
  }

  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (manifest.name !== '@microwavedev/backpack-game-core') {
    throw new Error(
      `Unexpected core package name "${manifest.name}" in ${path.relative(root, packagePath)}.`
    );
  }

  return {
    coreDir,
    packageName: manifest.name,
    version: manifest.version || null
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkBackpackGameCoreSubmodule();
  console.log(`backpack-game-core submodule OK: ${path.relative(repoRoot, result.coreDir)} (${result.packageName})`);
}
