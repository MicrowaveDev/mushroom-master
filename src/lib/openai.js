import fs from 'node:fs/promises';
import OpenAI from 'openai';

export function createOpenAiClient(apiKey) {
  return new OpenAI({ apiKey });
}

function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}

function parseJsonResponse(text) {
  return JSON.parse(stripMarkdownFence(text));
}

export async function analyzeImage(client, model, imagePath) {
  const bytes = await fs.readFile(imagePath);
  const base64 = bytes.toString('base64');

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Analyze the image and return strict JSON only.',
              'Classify it as either "screenshot" or "photo".',
              'If it is a screenshot, fill "extracted_text" with only the visible text in the original language.',
              'If it is a photo, fill "description" with a short factual description and "title" with a short caption.',
              'If mushrooms or mushroom-related imagery are visible in a photo, mention that clearly.',
              'Do not translate visible text.',
              'Return this JSON shape exactly:',
              '{"kind":"screenshot|photo","title":"","extracted_text":"","description":""}'
            ].join(' ')
          },
          {
            type: 'input_image',
            image_url: `data:image/png;base64,${base64}`,
            detail: 'low'
          }
        ]
      }
    ]
  });

  const parsed = parseJsonResponse(response.output_text);
  return {
    kind: parsed.kind === 'photo' ? 'photo' : 'screenshot',
    title: String(parsed.title || '').trim(),
    extractedText: stripMarkdownFence(String(parsed.extracted_text || '')),
    description: String(parsed.description || '').trim()
  };
}

export async function createMushroomLore(client, model, markdownMessages, photoEntries) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You turn Telegram notes into a coherent mushroom-lore field guide in markdown.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Write a rich markdown document about mushrooms using the ideas, details, observations, and imagery in the source material.',
              'Preserve concrete facts from the source where possible, but shape them into a cohesive lore-style narrative.',
              'Use this structure:',
              '# title',
              '## overview',
              '## species notes',
              '## folklore and atmosphere',
              '## practical observations',
              '## field gallery',
              '## closing',
              '',
              'Source material:',
              markdownMessages.join('\n\n---\n\n'),
              '',
              'Photo notes:',
              photoEntries.length > 0 ? photoEntries.join('\n\n') : 'No photo notes available.'
            ].join('\n')
          }
        ]
      }
    ]
  });

  return response.output_text.trim();
}

export async function cleanLoreMessages(client, model, messages) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: [
              'You clean Telegram lore messages in a multitask way.',
              'Your job is to:',
              '1. remove text not related to the mushroom lore itself, such as assistant-like prompts, invitations to continue, brainstorming offers, or meta conversation',
              '2. remove repeated lore fragments only when a message redundantly repeats what is already established in other messages nearby',
              '3. preserve every distinct feature, specification, and fact even if phrasing is similar',
              '4. do not optimize or shorten a message just because it is verbose',
              '5. keep the original language and style'
            ].join(' ')
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Return strict JSON only.',
              'Analyze the full set together so you can detect cross-message repetition and off-topic conversational leftovers.',
              'Only change a message when you are confident the removed text is either non-lore/meta or redundant because it duplicates another message.',
              'Do not treat repetition inside a single message as a cleanup reason by itself.',
              'Do not shorten unique lore details just for style.',
              'JSON shape:',
              '{"results":[{"id":123,"changed":true|false,"cleaned_text":"","notes":"","removed_types":["meta_prompt|cross_message_duplication"]}]}',
              '',
              'Messages:',
              JSON.stringify(messages, null, 2)
            ].join('\n')
          }
        ]
      }
    ]
  });

  const parsed = parseJsonResponse(response.output_text);
  return Array.isArray(parsed.results)
    ? parsed.results.map((item) => ({
        id: Number(item.id),
        changed: Boolean(item.changed),
        cleanedText: String(item.cleaned_text || '').trim(),
        notes: String(item.notes || '').trim(),
        removedTypes: Array.isArray(item.removed_types) ? item.removed_types.map((entry) => String(entry)) : []
      }))
    : [];
}

export async function analyzeLorePromptReport(client, model, sourceMarkdown, loreMarkdown) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You review generated lore quality and propose prompt improvements. Return markdown only.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Analyze the source markdown and the generated mushroom lore.',
              'Produce a markdown report with these sections exactly:',
              '# Lore Prompt Analysis',
              '## Findings',
              '## Missing Or Weakened Details',
              '## Prompt Adjustment Recommendations',
              '## Revised Prompt',
              '',
              'Focus on completeness, lore fidelity, preservation of concrete features/specifications, and better integration of source details.',
              '',
              'Source markdown:',
              sourceMarkdown,
              '',
              'Generated lore markdown:',
              loreMarkdown
            ].join('\n')
          }
        ]
      }
    ]
  });

  return response.output_text.trim();
}

export async function analyzePdfStructureReport(client, model, loreMarkdown, htmlContent) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You review HTML/PDF presentation quality and propose concrete layout improvements. Return markdown only.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Analyze the mushroom lore markdown and current HTML used for PDF generation.',
              'Produce a markdown report with these sections exactly:',
              '# PDF Structure Analysis',
              '## Findings',
              '## Layout Recommendations',
              '## Content Organization Recommendations',
              '## Renderer Adjustment Suggestions',
              '',
              'Focus on section order, image placement, captions, long-text readability, page-break behavior, and typography.',
              '',
              'Lore markdown:',
              loreMarkdown,
              '',
              'Current HTML:',
              htmlContent
            ].join('\n')
          }
        ]
      }
    ]
  });

  return response.output_text.trim();
}
