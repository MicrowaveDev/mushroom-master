import fs from 'node:fs';
import path from 'node:path';
import { fileSha256 } from './bitmap-image-toolkit.js';

const imageExtensions = new Set(['.png', '.webp', '.jpg', '.jpeg']);

export function walkGeneratedImages(root, {
  maxDepth,
  cutoffMs,
  out,
  strictlyNewer = false
}) {
  if (!root || !fs.existsSync(root)) return out;
  const stack = [{ dir: path.resolve(root), depth: 0 }];
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
      if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      if (strictlyNewer ? stat.mtimeMs <= cutoffMs : stat.mtimeMs < cutoffMs) continue;
      out.push({
        path: fullPath,
        mtime: new Date(stat.mtimeMs).toISOString(),
        bytes: stat.size,
        sha256: fileSha256(fullPath)
      });
    }
  }
  return out;
}
