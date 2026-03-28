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
  const cleaned = stripMarkdownFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error(`Unable to parse JSON response: ${cleaned}`);
    }

    const candidate = objectMatch[0]
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(candidate);
  }
}

export async function analyzeImage(client, model, imagePath, options = {}) {
  const bytes = await fs.readFile(imagePath);
  const base64 = bytes.toString('base64');
  const detail = options.detail === 'high' ? 'high' : 'low';

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
              'If it is a photo, fill "description" with a factual visual description.',
              'For character or figurine photos, describe face, eyes, makeup, hair, headwear, outfit, colors, pose, and any visible mushroom-related motifs when they are visible.',
              'If makeup, eye styling, or facial details are not visible, say so briefly rather than inventing them.',
              'Keep the title short and caption-like.',
              'If mushrooms or mushroom-related imagery are visible in a photo, mention that clearly.',
              'Do not translate visible text.',
              'Return this JSON shape exactly:',
              '{"kind":"screenshot|photo","title":"","extracted_text":"","description":"","visual_details":{"face":"","eyes":"","makeup":"","hair":"","headwear":"","outfit":"","colors":"","pose":"","mushroom_motifs":"","visibility_notes":""}}'
            ].join(' ')
          },
          {
            type: 'input_image',
            image_url: `data:image/png;base64,${base64}`,
            detail
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
    description: String(parsed.description || '').trim(),
    visualDetails: parsed.visual_details && typeof parsed.visual_details === 'object'
      ? {
          face: String(parsed.visual_details.face || '').trim(),
          eyes: String(parsed.visual_details.eyes || '').trim(),
          makeup: String(parsed.visual_details.makeup || '').trim(),
          hair: String(parsed.visual_details.hair || '').trim(),
          headwear: String(parsed.visual_details.headwear || '').trim(),
          outfit: String(parsed.visual_details.outfit || '').trim(),
          colors: String(parsed.visual_details.colors || '').trim(),
          pose: String(parsed.visual_details.pose || '').trim(),
          mushroomMotifs: String(parsed.visual_details.mushroom_motifs || '').trim(),
          visibilityNotes: String(parsed.visual_details.visibility_notes || '').trim()
        }
      : null
  };
}

export async function createMushroomLore(client, model, sourceBundle) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Ты превращаешь заметки из Telegram в цельное структурированное markdown-досье на русском языке с отдельными разделами общего лора и персонажей.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Напиши насыщенный markdown-документ по лору на русском языке на основе структурированного Telegram-источника.',
              'Сохраняй конкретные факты, имена, способности, артефакты, мотивы и связи из источников, когда это возможно.',
              'Документ должен иметь такую структуру:',
              '# Заголовок',
              '## Общий лор',
              '### Обзор мира',
              '### Фракции, места и атмосфера',
              '### Общие мотивы и системы',
              '## Персонажи',
              '### <Имя персонажа>',
              '![<Имя персонажа>](<путь к изображению>)',
              '#### Обзор',
              '#### Внешность',
              '#### Способности и черты',
              '#### Мотивы и роль',
              '#### Связи и сюжетные линии',
              '',
              'Правила:',
              '- Используй один блок `### <Имя персонажа>` для каждого персонажа или сущности из структурированного источника.',
              '- Если есть изображения персонажа, ставь главное изображение сразу после заголовка `### <Имя персонажа>`, до обзорного текста.',
              '- Не создавай отдельный хвостовой раздел с визуальными референсами.',
              '- Неконкретизированный мировой материал помещай в `## Общий лор`.',
              '- Если для подраздела нет опоры в источнике, пропускай его, а не выдумывай детали.',
              '- Не используй формат полевого справочника или практических заметок.',
              '- Предпочитай более полный профиль как каноничное имя персонажа, если есть несколько вариантов имени.',
              '- При описании персонажа приоритет всегда такой: текстовый лор из source markdown и OCR выше, чем image description и visualDetails из character manifest.',
              '- Используй image description и `visualDetails` только как fallback для недостающих визуальных деталей, а не как замену уже описанному в текстовом лоре.',
              '- Если в структурированном источнике для изображения есть `visualDetails`, используй их только для дополнения раздела `#### Внешность`, когда текстовые источники этого не покрывают.',
              '- В разделе `#### Внешность` отдельно учитывай лицо, глаза, макияж, волосы, головной убор, одежду, цвета и позу, если эти поля присутствуют в `visualDetails`, но не противоречат текстовому лору.',
              '- Используй markdown-изображения строго с переданными значениями `generatedRelativePath`.',
              '- Верни только markdown на русском языке.',
              '',
              'Структурированный JSON-источник:',
              JSON.stringify(sourceBundle, null, 2)
            ].join('\n')
          }
        ]
      }
    ]
  });

  return stripMarkdownFence(response.output_text).trim();
}

export async function createGeneralLoreSection(client, model, sourceBundle) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Ты создаёшь только раздел общего лора на русском языке по структурированным источникам Telegram.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Напиши только раздел `## Общий лор` в markdown.',
              'Внутри него используй насыщенные подразделы:',
              '### Обзор мира',
              '### Фракции, места и атмосфера',
              '### Общие мотивы и системы',
              '',
              'Правила:',
              '- Используй только переданные источники общего лора.',
              '- Если передан блок instructions, соблюдай его как редакторские указания более высокого приоритета, чем обычный порядок из источников.',
              '- Не добавляй раздел `## Персонажи`.',
              '- Не дублируй character dossiers.',
              '- Сохраняй конкретные названия, артефакты, механики, мотивы и атмосферные детали.',
              '- Верни только markdown на русском языке.',
              '',
              'Структурированный JSON-источник:',
              JSON.stringify(sourceBundle, null, 2)
            ].join('\n')
          }
        ]
      }
    ]
  });

  return stripMarkdownFence(response.output_text).trim();
}

export async function createCharacterLoreSection(client, model, characterBundle) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Ты создаёшь только один насыщенный character dossier на русском языке по структурированным источникам Telegram.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              `Напиши только один markdown-блок персонажа для \`${characterBundle.name}\`.`,
              'Структура должна быть такой:',
              `### ${characterBundle.name}`,
              `![${characterBundle.name}](<path>)`,
              '#### Обзор',
              '#### Внешность',
              '#### Способности и черты',
              '#### Мотивы и роль',
              '#### Связи и сюжетные линии',
              '',
              'Правила:',
              '- Используй только источники, переданные для этого персонажа.',
              '- Если передан блок instructions, соблюдай его как редакторские указания более высокого приоритета.',
              '- Приоритет всегда такой: source markdown и OCR выше, чем image description и visualDetails.',
              '- Если есть structuredProfile, используй его как канонический костяк персонажа.',
              '- Если деталей для какого-то подраздела нет, пропускай подраздел, а не выдумывай.',
              '- Используй главное изображение персонажа сразу после заголовка.',
              '- Верни только markdown на русском языке.',
              '',
              'Структурированный JSON-источник:',
              JSON.stringify(characterBundle, null, 2)
            ].join('\n')
          }
        ]
      }
    ]
  });

  return stripMarkdownFence(response.output_text).trim();
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
  return analyzePdfStructureReportWithPages(client, model, loreMarkdown, htmlContent, []);
}

export async function analyzePdfStructureReportWithPages(client, model, loreMarkdown, htmlContent, pageImages = []) {
  const imageContent = await Promise.all(
    pageImages.slice(0, 12).map(async (pageImage) => {
      const bytes = await fs.readFile(pageImage.path);
      return [
        {
          type: 'input_text',
          text: `Rendered PDF page ${pageImage.pageNumber}`
        },
        {
          type: 'input_image',
          image_url: `data:image/png;base64,${bytes.toString('base64')}`,
          detail: 'low'
        }
      ];
    })
  );

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: [
              'You review HTML/PDF presentation quality and propose concrete layout improvements.',
              'Prioritize what is actually visible on rendered page images over what the markdown intended.',
              'Check page balance, whitespace, image placement, repeated headings, broken section flow, weak hierarchy, and awkward page breaks.',
              'Return markdown only.'
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
              'Analyze the mushroom lore markdown and current HTML used for PDF generation.',
              'Also analyze the rendered PDF page screenshots when provided.',
              'Produce a markdown report with these sections exactly:',
              '# PDF Structure Analysis',
              '## Findings',
              '## Layout Recommendations',
              '## Content Organization Recommendations',
              '## Renderer Adjustment Suggestions',
              '## Review Instructions',
              '',
              'Focus on section order, image placement, captions, long-text readability, page-break behavior, typography, visual balance, and whether character intro sections are laid out correctly.',
              'In `## Review Instructions`, write a short reusable checklist for future agents reviewing the generated page images.',
              '',
              'Lore markdown:',
              loreMarkdown,
              '',
              'Current HTML:',
              htmlContent
            ].join('\n')
          },
          ...imageContent.flat()
        ]
      }
    ]
  });

  return response.output_text.trim();
}
