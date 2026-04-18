export function extractSection(markdown, title) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return '';
  }

  const bodyStart = start + heading.length;
  const nextSecondLevel = markdown.indexOf('\n## ', bodyStart);
  const nextTopLevel = markdown.indexOf('\n# ', bodyStart);
  const endCandidates = [nextSecondLevel, nextTopLevel]
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return markdown.slice(bodyStart, end).trim();
}

export function extractMessageSection(markdown, title) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return '';
  }

  const bodyStart = start + heading.length;
  const knownHeadings = [
    '\n## Hashtags\n',
    '\n## Text\n',
    '\n## Media\n',
    '\n## OCR\n',
    '\n## Photo\n',
    '\n## Character Visual Details\n'
  ].filter((candidate) => candidate !== `\n## ${title}\n`);

  const endCandidates = knownHeadings
    .map((candidate) => markdown.indexOf(candidate, bodyStart))
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return markdown.slice(bodyStart, end).trim();
}

export function replaceSection(markdown, title, content) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return markdown;
  }

  const bodyStart = start + heading.length;
  const nextSecondLevel = markdown.indexOf('\n## ', bodyStart);
  const nextTopLevel = markdown.indexOf('\n# ', bodyStart);
  const endCandidates = [nextSecondLevel, nextTopLevel]
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return `${markdown.slice(0, bodyStart)}${content.trim()}\n${markdown.slice(end)}`;
}

export function normalizeHashtag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

export function isValidHashtag(tag) {
  return /^#[\p{L}\p{N}_]+$/u.test(tag);
}

export function extractHashtags(markdown) {
  const section = extractMessageSection(markdown, 'Hashtags');
  if (!section) {
    return [];
  }

  return Array.from(new Set(
    section
      .split(/\s+/u)
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));
}

export function parseTaggedMessageText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { text: '', hashtags: [] };
  }

  const lines = raw.split('\n');
  const trailingHashtagLines = [];
  while (lines.length > 0) {
    const candidate = lines[lines.length - 1].trim();
    if (/^(#[\p{L}\p{N}_]+\s*)+$/u.test(candidate)) {
      trailingHashtagLines.unshift(candidate);
      lines.pop();
      continue;
    }
    break;
  }

  const hashtags = Array.from(new Set(
    trailingHashtagLines
      .join(' ')
      .split(/\s+/u)
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));

  return {
    text: lines.join('\n').trim(),
    hashtags
  };
}

export function composeTaggedMessageText(text, hashtags) {
  const normalizedTags = Array.from(new Set(
    (hashtags || [])
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));
  const cleanText = String(text || '').trim();
  if (normalizedTags.length === 0) {
    return cleanText;
  }
  return [cleanText, normalizedTags.join(' ')].filter(Boolean).join('\n\n').trim();
}

export function parseOcrRepostText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { sourceHeader: '', text: '', hashtags: [] };
  }

  const lines = raw.split('\n');
  const sourceHeader = lines.shift()?.trim() || '';
  const remainder = lines.join('\n').trim();
  const parsed = parseTaggedMessageText(remainder);
  return {
    sourceHeader,
    text: parsed.text,
    hashtags: parsed.hashtags
  };
}

export function composeOcrRepostText(sourceMessageId, text, hashtags) {
  const header = `#${sourceMessageId}`;
  const body = composeTaggedMessageText(text, hashtags);
  return [header, body].filter(Boolean).join('\n\n').trim();
}

export function hashtagsToCharacterKeys(hashtags) {
  return hashtags
    .filter((tag) => normalizeHashtag(tag).startsWith('#character_'))
    .map((tag) => tag.replace(/^#character_/u, ''))
    .filter(Boolean);
}

export function extractMessageIdFromMarkdown(markdown) {
  const match = markdown.match(/^- Message ID: (\d+)$/m);
  return match ? Number(match[1]) : null;
}

export function splitThirdLevelSections(markdown) {
  const matches = Array.from(markdown.matchAll(/^###\s+(.+)$/gm));
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    return {
      title: String(match[1] || '').trim(),
      content: markdown.slice(start, end).trim()
    };
  });
}

export function splitFourthLevelSections(markdown) {
  const matches = Array.from(markdown.matchAll(/^####\s+(.+)$/gm));
  if (matches.length === 0) {
    return { preface: markdown.trim(), sections: [] };
  }

  const preface = markdown.slice(0, matches[0].index).trim();
  const sections = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    return {
      title: String(match[1] || '').trim(),
      body: markdown.slice(start, end).trim()
    };
  });

  return { preface, sections };
}

export function stripMarkdownImages(markdown) {
  return markdown
    .replace(/(?:^|\n)!\[[^\]]*\]\([^)]+\)\s*(?=\n|$)/gm, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanupRepeatedHorizontalRules(markdown) {
  return markdown
    .replace(/\n(?:---\s*\n){2,}/g, '\n---\n')
    .replace(/(?:\n\s*){3,}---/g, '\n\n---')
    .trim();
}

export function normalizeLooseMarkdownBody(markdown) {
  return String(markdown || '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeStructuredSectionBody(markdown) {
  return normalizeLooseMarkdownBody(
    String(markdown || '')
      .replace(/^\s*#+\s+/gm, '')
  );
}

export function mergeStructuredBodies(...parts) {
  return normalizeLooseMarkdownBody(
    parts
      .map((part) => normalizeLooseMarkdownBody(part))
      .filter(Boolean)
      .join('\n\n')
  );
}

export function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinParagraphs(parts) {
  return parts.filter(Boolean).join('\n\n').trim();
}

export function normalizeTextForDupCompare(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
