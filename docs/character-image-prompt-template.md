# Character Image Prompt Template

This file is the repo-wide base template for generating character illustration prompts from canon character data.

Use it when you want an agent to:
- read a character's existing repo canon
- synthesize appearance, role, mood, props, motifs, and palette
- produce a final copy-paste-ready image generation prompt in the same format as the previous character prompts

This is a prompt-building template for agents, not the final prompt itself.

## How To Use

Tell the agent to:
- use this file as the base
- inspect the target character's current repo canon first
- fill every concrete slot from source material when possible
- avoid inventing unsupported lore unless the user explicitly wants extrapolation
- keep the output as one clean prompt block suitable for ChatGPT image generation

If the canon is incomplete:
- preserve confirmed mechanics and tone
- mark uncertain visual details by making the safest style-consistent inference
- do not present guesses as if they were canon facts

## Agent Instructions

When using this template for a character:

1. Read the character's current canon in the repository.
2. Separate:
   - confirmed canon
   - reasonable visual inference
   - unsupported unknowns
3. Build a final prompt that feels specific and generation-ready, not like a worksheet.
4. Keep the visual style block stable unless the user asks for a different style.
5. Preserve these fixed output constraints:
   - single image
   - vertical composition
   - full-body
   - no text
   - no watermark
   - no UI
   - no detailed environment
6. Preserve strong anatomy constraints for hands and held props.
7. Prioritize:
   - silhouette clarity
   - gesture
   - readable props
   - coherent motif language
   - consistency with repo canon

## Base Prompt Skeleton

Use this exact structure as the base, then replace bracketed fields with character-specific content.

```text
Generate a single vertical full-body character illustration of an original fantasy character named [NAME].

Visual style:
- unfinished concept-art sketch
- cream / off-white sketchbook paper background
- visible blue construction lines underneath
- loose orange sketch lines on top
- layered, imperfect, spontaneous linework
- expressive anime-inspired fashion illustration
- oversized anime-style eyes
- stylized proportions with long limbs and elegant exaggeration
- minimal background, only a few faint grounding lines
- sketchy and under-rendered, not polished
- no clean line art
- no photorealism
- prioritize gesture, silhouette clarity, and expressive linework over tiny details

Character:
[Write 2-4 sentences describing the character's role, emotional read, combat fantasy, and overall thematic identity.]

Appearance:
- Skin: [skin description]
- Eyes: [eye description]
- Hair: [hair description]
- Face details: [face marks / expression / distinctive features]
- Body language: [how the figure should carry themselves]

Design motifs:
- [motif 1]
- [motif 2]
- [motif 3]
- [motif 4]

Outfit:
- [top / torso design]
- [bottom / leg design]
- [boots / shoes]
- [belt / gloves / bracers / robe / secondary garment]
- Overall silhouette: [silhouette rule]

Weapon / prop:
- [primary weapon, tool, or magical prop]
- [secondary ornament or magical effect]
- [how it should feel or function visually]
- it must sit naturally in the hand

Pose:
- full-body
- clear readable silhouette
- fashion-illustration stance
- [pose energy and action read]
- one hand [holding / directing / balancing / gesturing]
- the other hand [holding / relaxed / supporting / casting]
- natural hands are extremely important

Anatomy requirements:
- hands must be clear and correctly formed
- no broken wrists
- no merged fingers
- no extra fingers
- props must sit naturally in the hand

Palette:
- [color 1]
- [color 2]
- [color 3]
- [color 4]
- [optional accent color]
- keep color sparse, sketchy, and concept-art-like

Output requirements:
- single image only
- vertical composition
- full-body character
- no text
- no watermark
- no UI
- no detailed environment
```

## Character Mapping Guide

Map repo canon into the prompt like this:

- `Character`:
  Use role, temperament, faction function, battle identity, and narrative vibe.

- `Appearance`:
  Use only explicit source descriptions first.
  If details are missing, infer conservatively from the character's established mechanics and theme.

- `Design motifs`:
  Pull recurring symbolic language:
  spores, mycelium, rot, gold filaments, portal tears, alchemy glass, fungal antlers, flash-cap forms, etc.

- `Outfit`:
  Prefer silhouette logic over generic costume filler.
  Ask: does this character read as regal, defensive, mobile, unstable, ritualistic, or predatory?

- `Weapon / prop`:
  Use confirmed items first.
  If no explicit weapon exists, choose a subtle prop that fits their magic and role.

- `Pose`:
  Match combat identity:
  control = still / sovereign
  defensive = rooted / guarded
  aggressive = forward / striking
  balanced = poised / ready
  trickster / pathfinder = drifting / asymmetric

- `Palette`:
  Pull from canon first.
  If canon is incomplete, derive from theme rather than random preference.

## Output Contract For Agents

When the user asks for a prompt:
- do not return the worksheet with brackets still present
- do return one fully written prompt block
- do keep the phrasing natural and generator-ready
- do not include analysis unless the user asked for it
- do not mention repo paths in the final prompt
- do not include canon disclaimers inside the prompt itself

## Short Agent Request Example

Use `docs/character-image-prompt-template.md` as the base.
Read the repo canon for `[character-name]`.
Then produce one final copy-paste-ready ChatGPT image prompt in the same style and structure as the previous character prompts:
- vertical
- full-body
- sketchbook concept-art style
- no text / no UI / no watermark
- strong hand anatomy constraints
- tailored to the character's canon appearance, role, props, motifs, and palette
