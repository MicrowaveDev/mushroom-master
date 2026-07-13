#!/usr/bin/env node
/**
 * Bounded locator for Codex imagegen files.
 *
 * Use this after built-in imagegen renders in chat to verify whether a real PNG
 * landed on disk. It intentionally avoids broad home-directory scans.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const imageExts = new Set(['.png', '.webp', '.jpg', '.jpeg']);

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function parseNumberArg(argv, name, fallback) {
  const arg = argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

function parseListArg(argv, name) {
  const arg = argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) return [];
  return arg.slice(name.length + 3).split(path.delimiter).map((item) => item.trim()).filter(Boolean);
}

function fileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function walkImages(root, { maxDepth, cutoffMs, out }) {
  if (!root || !fs.existsSync(root)) return;
  const resolvedRoot = path.resolve(root);
  const stack = [{ dir: resolvedRoot, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (entry.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || !imageExts.has(path.extname(entry.name).toLowerCase())) continue;
      if (stat.mtimeMs < cutoffMs) continue;
      out.push({
        path: fullPath,
        mtime: new Date(stat.mtimeMs).toISOString(),
        bytes: stat.size,
        sha256: fileSha256(fullPath)
      });
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const sinceMinutes = parseNumberArg(argv, 'since-minutes', 120);
  const limit = parseNumberArg(argv, 'limit', 10);
  const includeTemp = hasFlag(argv, 'include-temp');
  const home = process.env.HOME || '';
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const roots = [
    path.join(codexHome, 'generated_images'),
    path.join(codexHome, 'images'),
    path.join(home, 'Library', 'Application Support', 'Codex'),
    path.join(home, 'Library', 'Caches', 'Codex'),
    path.join(home, 'Library', 'Application Support', 'OpenAI'),
    path.join(home, 'Library', 'Caches', 'OpenAI'),
    ...parseListArg(argv, 'root')
  ];
  if (includeTemp) {
    roots.push('/private/var/folders');
  }

  const cutoffMs = Date.now() - (sinceMinutes * 60 * 1000);
  const found = [];
  for (const root of roots) {
    walkImages(root, {
      maxDepth: root === '/private/var/folders' ? 8 : 6,
      cutoffMs,
      out: found
    });
  }

  found.sort((a, b) => Date.parse(b.mtime) - Date.parse(a.mtime));
  const unique = [];
  const seen = new Set();
  for (const entry of found) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    unique.push(entry);
    if (unique.length >= limit) break;
  }

  if (unique.length === 0) {
    console.log(`codex generated image locator: no image files found in bounded roots from the last ${sinceMinutes} minute(s)`);
    console.log('Use --include-temp for a bounded macOS temp scan, or --root=<path> for an explicit extra root.');
    process.exit(1);
  }

  console.log(`codex generated image locator: ${unique.length} image file(s) found`);
  for (const entry of unique) {
    console.log(`${entry.mtime} ${entry.bytes}B ${entry.sha256} ${entry.path}`);
  }
}

main();
