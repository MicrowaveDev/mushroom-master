import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { readMarkdown, writeMarkdown, fileExists } from './storage.js';
import {
  extractMessageSection,
  extractHashtags,
  hashtagsToCharacterKeys,
  extractMessageIdFromMarkdown,
  splitThirdLevelSections,
  splitFourthLevelSections,
  stripMarkdownImages,
  cleanupRepeatedHorizontalRules,
  normalizeStructuredSectionBody,
  normalizeTextForDupCompare
} from './markdown-parser.js';
import {
  extractCharacterName,
  toCharacterKey,
  parseStructuredCharacterProfile,
  isSubstantiveCharacterSource,
  ensureTemporaryCharacterImages,
  writeCharacterManifests,
  parseLoreInstructionsFromText,
  orderCharactersByInstructions
} from './character.js';
import { createGeneralLoreSection, createCharacterLoreSection } from './openai.js';
import { sendPdfViaBot } from './bot.js';
import { renderMarkdownToHtmlAndPdf } from './render.js';

function readCharacterVisualDetails(markdown) {
  const section = extractMessageSection(markdown, 'Character Visual Details');
  if (!section) {
    return null;
  }

  try {
    const parsed = JSON.parse(section);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function buildInstructionEntries(records) {
  return records
    .filter((record) => record.isInstructionsTagged && !record.isExcludedFromLore)
    .map((record) => {
      const text = record.narrativeText || '';
      return {
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        text,
        parsed: parseLoreInstructionsFromText(text)
      };
    });
}

async function readExistingCharacterManifestMap(dirs) {
  const manifestMap = new Map();
  let entries = [];

  try {
    entries = await fs.readdir(dirs.charactersDir, { withFileTypes: true });
  } catch {
    return manifestMap;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(dirs.charactersDir, entry.name, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      const key = toCharacterKey(parsed?.key || parsed?.name || entry.name);
      if (!key) {
        continue;
      }

      const images = Array.isArray(parsed?.images)
        ? parsed.images.map((image) => ({
            sourceMessageId: image.sourceMessageId ?? null,
            caption: image.caption || '',
            description: image.description || '',
            visualDetails: image.visualDetails || null,
            generatedRelativePath: image.generatedRelativePath || '',
            assetPath: path.resolve(path.dirname(manifestPath), image.assetPath || ''),
            temporary: /temp-character-images\/.+\.svg$/i.test(String(image.generatedRelativePath || ''))
          }))
        : [];

      manifestMap.set(key, {
        ...parsed,
        images
      });
    } catch {
      // Ignore malformed or missing manifests and continue.
    }
  }

  return manifestMap;
}

export function normalizeGeneratedLoreMarkdown(markdown, sourceBundle) {
  const cleanedMarkdown = cleanupRepeatedHorizontalRules(markdown);
  const charactersHeading = '\n## Персонажи\n';
  const headingIndex = cleanedMarkdown.indexOf(charactersHeading);
  if (headingIndex === -1) {
    return cleanedMarkdown.trim();
  }

  const beforeCharacters = cleanedMarkdown.slice(0, headingIndex + charactersHeading.length).trimEnd();
  const charactersBlock = cleanedMarkdown.slice(headingIndex + charactersHeading.length).trim();
  const characterSections = splitThirdLevelSections(charactersBlock);
  if (characterSections.length === 0) {
    return cleanedMarkdown.trim();
  }

  const canonicalCharacters = new Map(
    (sourceBundle.characters || []).map((character) => [toCharacterKey(character.name), character])
  );
  const subsectionOrder = [
    'Обзор',
    'Внешность',
    'Особенности',
    'Мотивы и роль',
    'Связи и сюжетные линии'
  ];
  const subsectionAliases = {
    'Особенности': ['Особенности', 'Способности и черты']
  };

  // Separate real character sections from non-character sections (e.g. "Взаимоотношения в квартете")
  const realCharacterSections = [];
  const orphanedSections = [];
  for (const section of characterSections) {
    if (canonicalCharacters.has(toCharacterKey(section.title))) {
      realCharacterSections.push({ ...section, appendedRelationships: [] });
    } else {
      orphanedSections.push(section);
    }
  }

  // Merge orphaned sections into the previous character's "Связи и сюжетные линии"
  for (const orphan of orphanedSections) {
    const orphanIndex = characterSections.indexOf(orphan);
    let target = realCharacterSections[realCharacterSections.length - 1];
    for (let i = orphanIndex - 1; i >= 0; i -= 1) {
      const candidate = realCharacterSections.find(
        (s) => toCharacterKey(s.title) === toCharacterKey(characterSections[i].title)
      );
      if (candidate) {
        target = candidate;
        break;
      }
    }
    if (target) {
      const lines = orphan.content.split('\n');
      lines.shift(); // remove ### heading
      const body = stripMarkdownImages(lines.join('\n').trim());
      target.appendedRelationships.push(`**${orphan.title}**\n\n${body}`);
    }
  }

  const normalizedSections = realCharacterSections.map((section) => {
    const lines = section.content.split('\n');
    const headingLine = lines.shift() || '';
    const characterName = section.title;
    const canonicalCharacter = canonicalCharacters.get(toCharacterKey(characterName));
    const canonicalImage = canonicalCharacter?.images?.[0]?.generatedRelativePath || '';
    const structuredProfile = canonicalCharacter?.structuredProfile?.sections || {};
    const completenessTier = canonicalCharacter?.completenessTier || 'partial';
    const rawBody = stripMarkdownImages(lines.join('\n').trim());
    const { preface, sections } = splitFourthLevelSections(rawBody);
    const sectionMap = new Map(
      sections
        .map((entry) => [entry.title, normalizeStructuredSectionBody(entry.body)])
        .filter((entry) => entry[1])
    );

    if (preface) {
      const existingOverview = sectionMap.get('Обзор');
      sectionMap.set('Обзор', existingOverview ? `${preface}\n\n${existingOverview}` : preface);
    }

    for (const [preferredTitle, aliases] of Object.entries(subsectionAliases)) {
      const merged = aliases
        .map((title) => sectionMap.get(title))
        .filter(Boolean)
        .join('\n\n')
        .trim();
      for (const title of aliases) {
        if (title !== preferredTitle) {
          sectionMap.delete(title);
        }
      }
      if (merged) {
        sectionMap.set(preferredTitle, merged);
      }
    }

    // Append orphaned relationship content
    if (section.appendedRelationships.length > 0) {
      const existing = sectionMap.get('Связи и сюжетные линии') || '';
      sectionMap.set(
        'Связи и сюжетные линии',
        [existing, ...section.appendedRelationships].filter(Boolean).join('\n\n')
      );
    }

    for (const title of subsectionOrder) {
      const existing = sectionMap.get(title);
      const fallback = [title, ...(subsectionAliases[title] || [])]
        .map((key) => structuredProfile[key])
        .find(Boolean);
      const isWeakOverview = title === 'Обзор' && String(existing || '').trim().length < 80;
      if ((!existing || isWeakOverview) && fallback) {
        sectionMap.set(title, fallback);
      }
    }

    // Deduplicate Мотивы when it repeats Обзор content
    const overviewText = normalizeTextForDupCompare(sectionMap.get('Обзор') || '');
    const motivesText = normalizeTextForDupCompare(sectionMap.get('Мотивы и роль') || '');
    if (motivesText && overviewText && overviewText.includes(motivesText)) {
      sectionMap.delete('Мотивы и роль');
    }

    const rebuilt = [headingLine];
    if (canonicalImage) {
      rebuilt.push('', `![${characterName}](${canonicalImage})`);
    }

    for (const title of subsectionOrder) {
      const body = sectionMap.get(title);
      if (!body) {
        continue;
      }
      if (completenessTier === 'image_only' && title !== 'Обзор') {
        continue;
      }
      rebuilt.push('', `#### ${title}`, '', body.trim());
    }

    return rebuilt.join('\n').trim();
  });

  return cleanupRepeatedHorizontalRules(
    `${beforeCharacters}\n\n${normalizedSections.join('\n\n---\n\n')}`
  ).trim();
}

export async function collectLoreInputsFromStoredMarkdown(dirs) {
  const existingManifestMap = await readExistingCharacterManifestMap(dirs);
  const files = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();

  const loreSources = [];
  const photoEntries = [];
  const characterMap = new Map();
  const generalEntries = [];
  const fileRecords = [];

  for (const name of files) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const messageIdMatch = markdown.match(/^- Message ID: (\d+)$/m);
    const messageId = messageIdMatch ? Number(messageIdMatch[1]) : null;
    const textSection = extractMessageSection(markdown, 'Text');
    const ocrSection = extractMessageSection(markdown, 'OCR');
    const photoSection = extractMessageSection(markdown, 'Photo');
    const visualDetails = readCharacterVisualDetails(markdown);
    const hashtags = extractHashtags(markdown);
    const characterName = extractCharacterName(textSection);
    const structuredProfile = parseStructuredCharacterProfile(textSection);
    const taggedCharacterKeys = hashtagsToCharacterKeys(hashtags);
    const directCharacterKey = taggedCharacterKeys[0] || '';
    const isExcludedFromLore = hashtags.includes('#exclude_lore');
    const isGeneralLoreTagged = hashtags.includes('#general_lore');
    const isInstructionsTagged = hashtags.includes('#instructions');
    const hasExplicitRoutingTags = isExcludedFromLore || isGeneralLoreTagged || isInstructionsTagged || taggedCharacterKeys.length > 0;

    if (!isExcludedFromLore && textSection) {
      loreSources.push(textSection);
    }
    if (!isExcludedFromLore && ocrSection) {
      loreSources.push(ocrSection);
    }

    const narrativeParts = [textSection, ocrSection].filter(Boolean);
    const record = {
      filePath,
      fileName: name,
      sourceMessageId: messageId,
      hashtags,
      textSection,
      ocrSection,
      photoSection,
      narrativeText: narrativeParts.join('\n\n').trim(),
      directCharacterKey,
      taggedCharacterKeys,
      isExcludedFromLore,
      isGeneralLoreTagged,
      isInstructionsTagged,
      hasExplicitRoutingTags,
      image: null
    };
    fileRecords.push(record);
    if (taggedCharacterKeys.length > 0) {
      for (const characterKey of taggedCharacterKeys) {
        const current = characterMap.get(characterKey) || {
          key: characterKey,
          name: characterName || characterKey,
          sources: [],
          images: [],
          structuredProfile: null,
          completenessTier: 'partial'
        };
        if (characterName && (
          current.name === characterKey ||
          (current.name.length > characterName.length && structuredProfile)
        )) {
          current.name = characterName;
        }
        if (structuredProfile) {
          current.structuredProfile = structuredProfile;
        }
        if (narrativeParts.length > 0) {
          current.sources.push({
            sourceMessageId: messageId,
            text: narrativeParts.join('\n\n')
          });
        }
        characterMap.set(characterKey, current);
      }
    } else if (!isExcludedFromLore && isGeneralLoreTagged && narrativeParts.length > 0) {
      generalEntries.push({
        sourceMessageId: messageId,
        text: narrativeParts.join('\n\n')
      });
    }

    if (photoSection) {
      const imageMatch = photoSection.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\n\n([\s\S]*))?$/);
      if (imageMatch) {
        const caption = imageMatch[1].trim() || `Message ${messageId || 'unknown'} photo`;
        const sourceImagePath = path.resolve(path.dirname(filePath), imageMatch[2].trim());
        const relativeAssetPath = path.relative(dirs.generatedDir, sourceImagePath).split(path.sep).join('/');
        const description = String(imageMatch[3] || '').trim();
        const imageEntry = {
          sourceMessageId: messageId,
          caption,
          description,
          visualDetails,
          generatedRelativePath: relativeAssetPath,
          assetPath: sourceImagePath
        };
        record.image = imageEntry;
        photoEntries.push(
          [
            `### ${caption}`,
            '',
            messageId ? `Source message ID: ${messageId}` : 'Source message ID: unknown',
            '',
            `![${caption}](${relativeAssetPath})`,
            '',
            description || 'Photo preserved from the channel.'
          ].join('\n')
        );
        loreSources.push([caption, description].filter(Boolean).join('\n'));

        if (taggedCharacterKeys.length > 0) {
          for (const characterKey of taggedCharacterKeys) {
            const current = characterMap.get(characterKey) || {
              key: characterKey,
              name: characterName || characterKey,
              sources: [],
              images: [],
              structuredProfile: null,
              completenessTier: 'partial'
            };
            if (characterName && current.name === characterKey) {
              current.name = characterName;
            }
            current.images.push(imageEntry);
            characterMap.set(characterKey, current);
          }
        } else if (!isExcludedFromLore && isGeneralLoreTagged) {
          generalEntries.push({
            sourceMessageId: messageId,
            image: imageEntry
          });
        }
      }
    }
  }

  const instructionEntries = buildInstructionEntries(fileRecords);
  const characters = orderCharactersByInstructions(
    Array.from(characterMap.values()),
    instructionEntries
  );

  const charactersByKey = new Map(characters.map((character) => [character.key, character]));
  const routedRecords = fileRecords.map((record) => {
    const routedCharacterKeys = new Set();
    if (record.isExcludedFromLore) {
      return {
        ...record,
        routedCharacterKeys: []
      };
    }

    if (record.taggedCharacterKeys.length > 0) {
      for (const characterKey of record.taggedCharacterKeys) {
        if (charactersByKey.has(characterKey)) {
          routedCharacterKeys.add(characterKey);
        }
      }
    }

    return {
      ...record,
      routedCharacterKeys: Array.from(routedCharacterKeys)
    };
  });

  const enrichedCharacters = characters
    .map((character) => {
      const routedSources = routedRecords
        .filter((record) => (
          record.routedCharacterKeys.includes(character.key) &&
          record.narrativeText
        ))
        .map((record) => ({
          sourceMessageId: record.sourceMessageId,
          text: record.narrativeText,
          direct: record.directCharacterKey === character.key
        }));
      const routedImages = routedRecords
        .filter((record) => record.routedCharacterKeys.includes(character.key) && record.image)
        .map((record) => record.image);
      const substantiveSourceCount = routedSources.filter((source) => (
        isSubstantiveCharacterSource(source.text, character.name)
      )).length;

      let completenessTier = 'partial';
      if (character.structuredProfile) {
        completenessTier = 'full';
      } else if (substantiveSourceCount === 0 && routedImages.length > 0) {
        completenessTier = 'image_only';
      }

      const preservedImages = (existingManifestMap.get(character.key)?.images || [])
        .filter((image) => image.generatedRelativePath && !image.temporary);
      const finalImages = routedImages.length > 0 ? routedImages : preservedImages;

      return {
        ...character,
        sources: routedSources,
        images: finalImages,
        completenessTier
      };
    });
  const orderedCharacters = orderCharactersByInstructions(enrichedCharacters, instructionEntries);
  const charactersWithImages = await ensureTemporaryCharacterImages(dirs, orderedCharacters);

  await writeCharacterManifests(dirs, charactersWithImages);

  const sourceRouting = {
    instructions: instructionEntries.map((entry) => ({
      sourceMessageId: entry.sourceMessageId,
      filePath: entry.filePath,
      fileName: entry.fileName,
      parsed: entry.parsed
    })),
    generalLore: routedRecords
      .filter((record) => !record.isExcludedFromLore && record.isGeneralLoreTagged)
      .map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        routedCharacterKeys: record.routedCharacterKeys
      })),
    pending: routedRecords
      .filter((record) => !record.isExcludedFromLore && !record.isGeneralLoreTagged && record.routedCharacterKeys.length === 0)
      .map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        hashtags: record.hashtags
      })),
    characters: charactersWithImages.map((character) => ({
      name: character.name,
      key: character.key,
      completenessTier: character.completenessTier,
      sourceFiles: routedRecords
        .filter((record) => record.routedCharacterKeys.includes(character.key))
        .map((record) => ({
          sourceMessageId: record.sourceMessageId,
          filePath: record.filePath,
          fileName: record.fileName,
          direct: record.directCharacterKey === character.key
        }))
    }))
  };

  return {
    loreSources,
    photoEntries,
    characters: charactersWithImages,
    generalEntries,
    fileRecords: routedRecords,
    sourceRouting
  };
}

function computeSourceHash(sourceBundle) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(sourceBundle));
  return hash.digest('hex').slice(0, 16);
}

async function readPreviousSourceHash(generatedDir) {
  try {
    const hashPath = path.join(generatedDir, '.source-hash');
    return (await fs.readFile(hashPath, 'utf8')).trim();
  } catch {
    return null;
  }
}

async function writeSourceHash(generatedDir, hash) {
  await fs.writeFile(path.join(generatedDir, '.source-hash'), `${hash}\n`, 'utf8');
}

async function backupPreviousLore(generatedDir) {
  const lorePath = path.join(generatedDir, 'mushroom-lore.md');
  try {
    await fs.access(lorePath);
  } catch {
    return null;
  }

  const backupDir = path.join(generatedDir, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `mushroom-lore-${timestamp}.md`);
  await fs.copyFile(lorePath, backupPath);

  // Keep only the 5 most recent backups
  const backups = (await fs.readdir(backupDir))
    .filter((name) => name.startsWith('mushroom-lore-') && name.endsWith('.md'))
    .sort()
    .reverse();
  for (const old of backups.slice(5)) {
    await fs.unlink(path.join(backupDir, old));
  }

  return backupPath;
}

export async function writeLoreOutputs(ctx, options = {}) {
  const { sendPdf = true, force = false } = options;
  const {
    loreSources,
    photoEntries,
    characters,
    generalEntries,
    fileRecords,
    sourceRouting
  } = await collectLoreInputsFromStoredMarkdown(ctx.dirs);
  const sourceBundle = {
    summary: {
      sourceTextBlockCount: loreSources.length,
      photoCount: photoEntries.length,
      characterCount: characters.length,
      instructionCount: sourceRouting.instructions.length
    },
    instructions: sourceRouting.instructions,
    generalLore: generalEntries.map((entry) => ({
      sourceMessageId: entry.sourceMessageId,
      text: entry.text || '',
      image: entry.image
        ? {
            caption: entry.image.caption,
            description: entry.image.description,
            generatedRelativePath: entry.image.generatedRelativePath
          }
        : null
    })),
    characters: characters.map((character) => ({
      name: character.name,
      completenessTier: character.completenessTier,
      structuredProfile: character.structuredProfile || null,
      sources: character.sources,
      images: character.images.map((image) => ({
        sourceMessageId: image.sourceMessageId,
        caption: image.caption,
        description: image.description,
        visualDetails: image.visualDetails || null,
        generatedRelativePath: image.generatedRelativePath
      }))
    }))
  };
  await fs.writeFile(
    path.join(ctx.dirs.generatedDir, 'source-routing.json'),
    `${JSON.stringify(sourceRouting, null, 2)}\n`,
    'utf8'
  );

  // Content-hash-based skip: if sources haven't changed, reuse existing output
  const currentHash = computeSourceHash(sourceBundle);
  const previousHash = await readPreviousSourceHash(ctx.dirs.generatedDir);
  if (!force && currentHash === previousHash && await fileExists(path.join(ctx.dirs.generatedDir, 'mushroom-lore.md'))) {
    const lorePath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.md');
    const htmlPath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.html');
    const pdfPath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.pdf');
    const pageImagesDir = path.join(ctx.dirs.generatedDir, 'page-images');
    const pageImagesManifestPath = path.join(pageImagesDir, 'manifest.json');
    return { lorePath, htmlPath, pdfPath, pageImagesDir, pageImagesManifestPath, botResults: [], skipped: true };
  }

  // Backup previous lore before overwriting
  await backupPreviousLore(ctx.dirs.generatedDir);

  const generalFileRecords = fileRecords.filter((record) => (
    !record.isExcludedFromLore &&
    record.isGeneralLoreTagged
  ));
  const generalBundle = {
    summary: sourceBundle.summary,
    instructions: sourceRouting.instructions,
    entries: generalFileRecords.map((record) => ({
      sourceMessageId: record.sourceMessageId,
      filePath: record.filePath,
      text: record.narrativeText,
      image: record.image
        ? {
            caption: record.image.caption,
            description: record.image.description,
            generatedRelativePath: record.image.generatedRelativePath
          }
        : null,
      routedCharacterKeys: record.routedCharacterKeys
    }))
  };
  const generalLoreMarkdown = await createGeneralLoreSection(
    ctx.openai,
    ctx.config.openAiLoreModel,
    generalBundle
  );
  await writeMarkdown(
    path.join(ctx.dirs.generatedDir, 'general-lore-context.md'),
    `${generalLoreMarkdown.trim()}\n`
  );

  const characterSectionMarkdowns = [];
  for (const character of characters) {
    const routedFiles = fileRecords.filter((record) => record.routedCharacterKeys.includes(character.key));
    const characterBundle = {
      name: character.name,
      key: character.key,
      completenessTier: character.completenessTier,
      structuredProfile: character.structuredProfile || null,
      instructions: sourceRouting.instructions,
      generalContext: generalLoreMarkdown,
      sources: routedFiles.map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        directCharacterMatch: record.directCharacterKey === character.key,
        text: record.narrativeText,
        image: record.image
          ? {
              caption: record.image.caption,
              description: record.image.description,
              visualDetails: record.image.visualDetails || null,
              generatedRelativePath: record.image.generatedRelativePath
            }
          : null
      })),
      images: character.images.map((image) => ({
        sourceMessageId: image.sourceMessageId,
        caption: image.caption,
        description: image.description,
        visualDetails: image.visualDetails || null,
        generatedRelativePath: image.generatedRelativePath
      }))
    };
    const characterMarkdown = await createCharacterLoreSection(
      ctx.openai,
      ctx.config.openAiLoreModel,
      characterBundle
    );
    characterSectionMarkdowns.push(characterMarkdown.trim());
  }

  const composedLoreMarkdown = [
    '# Лор мира Золотого Кордицепса',
    '',
    generalLoreMarkdown.trim(),
    '',
    '## Персонажи',
    '',
    characterSectionMarkdowns.join('\n\n---\n\n')
  ].join('\n');
  const finalLoreMarkdown = `${normalizeGeneratedLoreMarkdown(composedLoreMarkdown, sourceBundle).trim()}\n`;
  const lorePath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.md');
  await writeMarkdown(lorePath, finalLoreMarkdown);

  const { htmlPath, pdfPath, pageImagesDir, manifestPath: pageImagesManifestPath } = await renderMarkdownToHtmlAndPdf(
    finalLoreMarkdown,
    'Грибной лор',
    ctx.dirs.generatedDir
  );

  const botResults = sendPdf
    ? await sendPdfViaBot({
      botToken: ctx.config.telegramBotToken,
      pdfPath,
      caption: `Грибной лор для ${ctx.config.channelUsername}`,
      channelUsername: ctx.config.channelUsername,
      channelChatId: ctx.botChatId,
        adminChatIds: ctx.config.adminChatIds,
        sendToChannel: ctx.config.botSendToChannel
      })
    : [];

  await writeSourceHash(ctx.dirs.generatedDir, currentHash);

  return { lorePath, htmlPath, pdfPath, pageImagesDir, pageImagesManifestPath, botResults };
}
