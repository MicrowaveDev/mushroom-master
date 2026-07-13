#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(scriptDir, '../../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const packageJson = readJson(path.join(repoRoot, 'package.json'));
const manifest = readJson(path.join(scriptsRoot, 'command-manifest.json'));
const readmePath = path.join(scriptsRoot, 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');

const errors = [];
const packageCommands = new Set(Object.keys(packageJson.scripts));
const documentedCommands = new Set();
const directoryIds = new Set();

for (const directory of manifest.directories || []) {
  if (!directory.id || directoryIds.has(directory.id)) {
    errors.push(`Invalid or duplicate script directory: ${directory.id || '<missing>'}`);
    continue;
  }
  directoryIds.add(directory.id);
  if (!directory.purpose || typeof directory.entryPoints !== 'boolean') {
    errors.push(`Script directory needs purpose and entryPoints: ${directory.id}`);
  }
  if (!fs.existsSync(path.join(scriptsRoot, directory.id))) {
    errors.push(`Manifest script directory does not exist: ${directory.id}`);
  }
}

const actualDirectories = fs.readdirSync(scriptsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
for (const directory of actualDirectories) {
  if (!directoryIds.has(directory)) errors.push(`Unclassified script directory: ${directory}`);
}
for (const entry of fs.readdirSync(scriptsRoot, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:js|sh)$/.test(entry.name)) {
    errors.push(`Executable script must be grouped, not stored at app/scripts root: ${entry.name}`);
  }
}

for (const family of manifest.families) {
  if (!readme.includes(`<!-- command-family:${family.id} -->`)) {
    errors.push(`README is missing command family ${family.id}`);
  }
  for (const command of family.commands) {
    if (documentedCommands.has(command)) errors.push(`Command is classified twice: ${command}`);
    documentedCommands.add(command);
  }
}

for (const alias of manifest.compatibilityAliases) {
  documentedCommands.add(alias.name);
  if (!alias.replacement || !alias.removeAfter) {
    errors.push(`Compatibility alias needs replacement and removeAfter: ${alias.name}`);
  }
}

for (const command of packageCommands) {
  if (!documentedCommands.has(command)) errors.push(`Unclassified package command: ${command}`);
}
for (const command of documentedCommands) {
  if (!packageCommands.has(command)) errors.push(`Manifest command does not exist: ${command}`);
}

for (const [command, value] of Object.entries(packageJson.scripts)) {
  for (const match of value.matchAll(/app\/scripts\/([^\s"']+\.(?:js|sh))/g)) {
    const relativePath = match[1];
    const [directory] = relativePath.split('/');
    const directoryEntry = manifest.directories?.find((entry) => entry.id === directory);
    if (!directoryEntry) errors.push(`Package command uses unclassified script path: ${command} -> ${relativePath}`);
    else if (!directoryEntry.entryPoints) errors.push(`Package command invokes internal script module: ${command} -> ${relativePath}`);
    if (!fs.existsSync(path.join(scriptsRoot, relativePath))) {
      errors.push(`Package command script does not exist: ${command} -> ${relativePath}`);
    }
  }
}

const readmeCommands = [...readme.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1]);
for (const command of readmeCommands) {
  if (!packageCommands.has(command)) errors.push(`README uses unknown command: ${command}`);
}

const homeFieldCount = [...packageCommands].filter((command) => command.startsWith('game:home-field:')).length;
if (homeFieldCount > manifest.homeFieldAliasLimit) {
  errors.push(`Home Field aliases exceed limit: ${homeFieldCount} > ${manifest.homeFieldAliasLimit}`);
}

for (const match of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const target = match[1].split('#')[0];
  if (!target || /^(https?:|mailto:)/.test(target)) continue;
  if (!fs.existsSync(path.resolve(scriptsRoot, target))) errors.push(`README link does not exist: ${target}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Script documentation OK: ${packageCommands.size} commands in ${manifest.families.length} families and ${directoryIds.size} directories, ${homeFieldCount} Home Field aliases.`);
}
