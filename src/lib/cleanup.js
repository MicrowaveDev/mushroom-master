import fs from 'node:fs/promises';
import path from 'node:path';
import { readMarkdown } from './storage.js';
import {
  extractMessageSection,
  normalizeTextForDupCompare,
  splitParagraphs,
  joinParagraphs
} from './markdown-parser.js';

export function stripKnownNoise(text) {
  return text
    .replace(/(?:^|\n)\s*Хочешь[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*Хотите[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*Как ты думаешь[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*расскажи\s*(?=\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*добавь\s*(?=\n|$)/giu, '\n')
    .replace(/AI responses may include mistakes\. Learn more/giu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isNoiseParagraph(text) {
  const normalized = text.toLowerCase().trim();
  return normalized.includes('хочешь ли ты') ||
    normalized.startsWith('хочешь ') ||
    normalized.startsWith('хотите ') ||
    normalized.startsWith('как ты думаешь') ||
    normalized === 'расскажи' ||
    normalized === 'добавь' ||
    (
      normalized.endsWith('?') &&
      (
        normalized.startsWith('она ') ||
        normalized.startsWith('он ') ||
        normalized.startsWith('или ') ||
        normalized.includes(' или ') ||
        normalized.includes(' просто ') ||
        normalized.includes(' хочет ') ||
        normalized.includes(' ищет способ ')
      )
    ) ||
    normalized.includes('ai responses may include mistakes') ||
    normalized.includes('learn more');
}

function isDominatedByOtherParagraph(current, other) {
  if (current.sourceMessageId === other.sourceMessageId) {
    return false;
  }

  if (current.normalized === other.normalized) {
    return other.sourceMessageId < current.sourceMessageId;
  }

  if (current.normalized.length < 50) {
    return false;
  }

  return (
    other.normalized.length >= current.normalized.length + 20 &&
    other.normalized.includes(current.normalized)
  );
}

function normalizeOverlapEdge(text) {
  return text
    .replace(/^[•\-–—*\s]+/u, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function trimMidSentenceCarryOver(paragraph, allParagraphs, currentTarget) {
  const currentText = paragraph.trim();
  if (!/^[a-zа-яё]/iu.test(currentText)) {
    return paragraph;
  }

  const boundaryMatch = currentText.match(/^(.{20,220}?[.!?])(?:\s+|$)/su);
  if (!boundaryMatch) {
    return paragraph;
  }

  const fragment = boundaryMatch[1].trim();
  const normalizedFragment = normalizeTextForDupCompare(fragment);
  if (normalizedFragment.length < 20) {
    return paragraph;
  }

  for (const other of allParagraphs) {
    if (other.targetKey === currentTarget.key) {
      continue;
    }
    if (other.sourceMessageId >= currentTarget.sourceMessageId) {
      continue;
    }

    if (other.normalized.includes(normalizedFragment)) {
      return currentText.slice(boundaryMatch[0].length).trim();
    }
  }

  return paragraph;
}

function trimLeadingCrossMessageOverlap(paragraph, allParagraphs, currentTarget) {
  let bestTrim = 0;

  for (const other of allParagraphs) {
    if (other.targetKey === currentTarget.key) {
      continue;
    }
    if (other.sourceMessageId >= currentTarget.sourceMessageId) {
      continue;
    }

    const otherText = other.original.trim();
    const currentText = paragraph.trim();
    if (!otherText || !currentText) {
      continue;
    }

    if (currentText.startsWith(otherText) && currentText.length > otherText.length + 20) {
      bestTrim = Math.max(bestTrim, otherText.length);
      continue;
    }

    if (otherText.endsWith(currentText) && currentText.length <= 80) {
      bestTrim = Math.max(bestTrim, currentText.length);
      continue;
    }

    const maxOverlap = Math.min(otherText.length, currentText.length);
    for (let size = maxOverlap; size >= 20; size -= 1) {
      const suffix = otherText.slice(-size).trim();
      const prefix = currentText.slice(0, size).trim();
      if (
        suffix &&
        prefix &&
        normalizeOverlapEdge(suffix) === normalizeOverlapEdge(prefix) &&
        currentText.length > size + 20
      ) {
        bestTrim = Math.max(bestTrim, size);
        break;
      }
    }
  }

  if (bestTrim === 0) {
    return trimMidSentenceCarryOver(paragraph, allParagraphs, currentTarget);
  }

  const trimmed = paragraph.slice(bestTrim).replace(/^[\s,.;:!?-]+/, '').trim();
  return trimMidSentenceCarryOver(trimmed, allParagraphs, currentTarget);
}

export async function loadDeterministicCleanupTargets(dirs) {
  const messageFiles = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();

  const targets = [];

  for (const name of messageFiles) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const sourceMessageIdMatch = markdown.match(/^- Message ID: (\d+)$/m);
    if (!sourceMessageIdMatch) {
      continue;
    }

    const sourceMessageId = Number(sourceMessageIdMatch[1]);
    const hasMedia = /^## Media$/m.test(markdown);
    const textSection = extractMessageSection(markdown, 'Text');
    const ocrSection = extractMessageSection(markdown, 'OCR');

    if (!hasMedia && textSection) {
      targets.push({
        key: `text:${sourceMessageId}`,
        kind: 'text',
        sourceMessageId,
        messageFile: filePath,
        text: textSection
      });
    }

    if (ocrSection) {
      targets.push({
        key: `ocr:${sourceMessageId}`,
        kind: 'ocr',
        sourceMessageId,
        messageFile: filePath,
        text: ocrSection
      });
    }
  }

  return targets;
}

export function computeDeterministicCleanup(targets) {
  const allParagraphs = [];

  for (const target of targets) {
    const paragraphs = splitParagraphs(target.text).map((text, index) => ({
      targetKey: target.key,
      sourceMessageId: target.sourceMessageId,
      index,
      original: text,
      normalized: normalizeTextForDupCompare(text)
    }));
    allParagraphs.push(...paragraphs);
  }

  return targets.map((target) => {
    const sanitizedText = stripKnownNoise(target.text);
    const targetParagraphs = splitParagraphs(sanitizedText).map((text, index) => ({
      targetKey: target.key,
      sourceMessageId: target.sourceMessageId,
      index,
      original: text,
      normalized: normalizeTextForDupCompare(text)
    }));
    const paragraphs = targetParagraphs;
    const kept = [];
    const removedTypes = new Set();
    const notes = [];

    if (sanitizedText !== target.text.trim()) {
      removedTypes.add('meta_prompt');
      notes.push('Removed known non-lore/meta sentence fragments.');
    }

    for (const paragraph of paragraphs) {
      if (!paragraph.normalized) {
        continue;
      }
      if (isNoiseParagraph(paragraph.original)) {
        removedTypes.add('meta_prompt');
        notes.push(`Removed non-lore/meta paragraph: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }

      const dominated = allParagraphs.some((other) => (
        other.targetKey !== paragraph.targetKey &&
        isDominatedByOtherParagraph(paragraph, other)
      ));

      if (dominated) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Removed paragraph duplicated more fully in another message: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }

      const trimmedLeadingOverlap = trimLeadingCrossMessageOverlap(paragraph.original, allParagraphs, target);
      if (!trimmedLeadingOverlap) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Removed leading overlap duplicated from an earlier message: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }
      if (trimmedLeadingOverlap !== paragraph.original.trim()) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Trimmed duplicated leading fragment from paragraph: "${paragraph.original.slice(0, 80)}"`);
      }

      kept.push(trimmedLeadingOverlap);
    }

    const cleanedText = joinParagraphs(kept);
    return {
      ...target,
      changed: cleanedText !== target.text.trim(),
      cleanedText,
      removedTypes: Array.from(removedTypes),
      notes: notes.join(' ')
    };
  });
}
