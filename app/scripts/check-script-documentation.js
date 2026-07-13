#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const packageJson = readJson(path.join(repoRoot, 'package.json'));
const manifest = readJson(path.join(scriptDir, 'command-manifest.json'));
const readmePath = path.join(scriptDir, 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');

const errors = [];
const packageCommands = new Set(Object.keys(packageJson.scripts));
const documentedCommands = new Set();

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
  if (!fs.existsSync(path.resolve(scriptDir, target))) errors.push(`README link does not exist: ${target}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Script documentation OK: ${packageCommands.size} commands in ${manifest.families.length} families, ${homeFieldCount} Home Field aliases.`);
}
