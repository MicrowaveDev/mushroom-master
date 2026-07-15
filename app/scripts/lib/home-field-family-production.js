import fs from 'node:fs';

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function allHomeFieldEntries(assetsDoc) {
  return [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((entry) => ({
      ...entry,
      type: 'character',
      width: entry.spritesheet.width,
      height: entry.spritesheet.height
    }))
  ];
}
