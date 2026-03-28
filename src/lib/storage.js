import fs from 'node:fs/promises';
import path from 'node:path';

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'channel';
}

export async function ensureChannelDirs(channelSlug) {
  const baseDir = path.join(process.cwd(), 'data', channelSlug);
  const dirs = {
    baseDir,
    messagesDir: path.join(baseDir, 'messages'),
    assetsDir: path.join(baseDir, 'assets'),
    generatedDir: path.join(baseDir, 'generated'),
    reportsDir: path.join(baseDir, 'generated', 'reports')
  };

  await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
  return dirs;
}

export function makeMessageStem(message) {
  const rawDate = message.date instanceof Date
    ? message.date
    : typeof message.date === 'number'
      ? new Date(message.date * 1000)
      : new Date(message.date);
  const date = rawDate;
  const timestamp = Number.isNaN(date.getTime()) ? 'unknown-date' : date.toISOString().replace(/[:.]/g, '-');
  return `${timestamp}-${message.id}`;
}

export async function writeMarkdown(filePath, content) {
  await fs.writeFile(filePath, content, 'utf8');
}

export async function readMarkdown(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
