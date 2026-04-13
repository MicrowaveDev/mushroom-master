# Character Image Prompt Template

This file is the repo-wide base template for generating character illustration prompts from canon character data.

Use it when you want an agent to:
- read a character's existing repo canon
- synthesize appearance, role, mood, props, motifs, and palette
- produce a final copy-paste-ready image generation prompt in the same format as the previous character prompts

This is a prompt-building template for agents, not the final prompt itself.

Default bias:
- prefer a simple, iconic, readable character design over a busy concept-sheet
- prefer face-first identity, silhouette clarity, and strong color blocking over dense equipment
- when the visual reference reads as an anime figurine / collectible doll, preserve that simplicity instead of "improving" it into heavier fantasy design
- do not assume the character should read as soft, sweet, or cute by default; derive the emotional read from canon and the reference
- default to figurine-like or illustration-like stylization based on the reference, not to chibi, unless the user explicitly asks for chibi
- preserve the reference's finish level: if it is rough, scratchy, layered, or visibly unfinished, do not polish it into clean line art

## How To Use

Tell the agent to:
- use this file as the base
- inspect the target character's current repo canon first
- inspect any user-provided reference image before locking the design direction
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
5. If the user provides a reference image, match its design logic before adding more lore-detail:
   - identify whether it is figurine-like, sketch-like, painted, realistic, editorial, or chibi-leaning
   - preserve the reference's simplicity level
   - preserve the reference's proportion logic
   - preserve the reference's emotional read: severe, regal, eerie, playful, predatory, calm, etc.
   - preserve the reference's finish level: rough, scratchy, loose, polished, clean, painterly, etc.
   - do not add costume complexity that is not supported by the reference or the canon
6. When in doubt, simplify:
   - fewer layers
   - fewer props
   - clearer silhouette
   - stronger head / face read
   - more iconic palette blocks
   - but do not collapse into super-deformed chibi proportions unless the reference clearly does so
7. Preserve these fixed output constraints:
   - single image
   - vertical composition
   - full-body
   - no text
   - no watermark
   - no UI
   - no detailed environment
8. Preserve strong anatomy constraints for hands and held props.
9. Prioritize:
   - likeness to the provided reference language when applicable
   - fidelity to the character's canon emotional read
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
- allow scratchy, overlapping, exploratory linework when the reference supports it
- expressive anime-inspired character illustration
- oversized anime-style eyes
- stylized proportions with readable, elegant exaggeration
- favor collectible figurine / doll-like proportions over chibi by default
- not super-deformed unless explicitly requested
- minimal background, only a few faint grounding lines
- sketchy and under-rendered, not polished
- no clean line art
- no photorealism
- preserve roughness if the reference is rough
- allow visible redraws and construction searching if the reference is sketch-like
- prioritize face readability, silhouette clarity, expressive linework, and simple iconic design over tiny details
- avoid unnecessary costume complexity
- if the reference is figurine-like or doll-like, preserve collectible simplicity instead of adding dense fantasy detail
- if the reference is figurine-like, preserve its emotional tone rather than automatically making the character cute

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
- Keep outfit complexity: [minimal / moderate / detailed]
- Do not overload the design with extra gear unless canon or the reference clearly demands it

Weapon / prop:
- [primary weapon, tool, or magical prop]
- [secondary ornament or magical effect]
- [how it should feel or function visually]
- Keep prop count low unless the canon specifically depends on multiple visible items
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
  Do not flatten every character into the same mood; extract the correct emotional read from canon.

- `Appearance`:
  Use only explicit source descriptions first.
  If details are missing, infer conservatively from the character's established mechanics and theme.
  If a provided reference image has a strong head/face language, preserve that first.
  Distinguish carefully between:
  - figurine-like
  - doll-like
  - chibi
  These are not interchangeable.
  Also distinguish carefully between:
  - youthful
  - regal
  - severe
  - eerie
  - aggressive
  - playful
  These are not interchangeable either.

- `Design motifs`:
  Pull recurring symbolic language:
  spores, mycelium, rot, gold filaments, portal tears, alchemy glass, fungal antlers, flash-cap forms, etc.
  Use fewer stronger motifs rather than many weak ones.
  Do not compensate for missing detail by over-polishing the drawing.

- `Outfit`:
  Prefer silhouette logic over generic costume filler.
  Ask: does this character read as regal, defensive, mobile, unstable, ritualistic, or predatory?
  If the reference is simple, keep the outfit simple.
  Do not translate a simple figurine reference into a dense RPG costume by default.

- `Weapon / prop`:
  Use confirmed items first.
  If no explicit weapon exists, choose a subtle prop that fits their magic and role.
  If the face / head / cloth silhouette is the main identity, let the prop stay secondary.

- `Pose`:
  Match combat identity:
  control = still / sovereign
  defensive = rooted / guarded
  aggressive = forward / striking
  balanced = poised / ready
  trickster / pathfinder = drifting / asymmetric
  If the reference is toy-like or figurine-like, prefer a simple readable gesture over a dramatic action pose unless the canon clearly wants aggression.
  If the reference is figurine-like, keep the body readable and graceful rather than super-deformed.

- `Finish level`:
  Match the reference's finish, not the model's default prettiness.
  If the reference is rough:
  - keep layered lines
  - keep visible redraws
  - keep imperfect contour quality
  - avoid cleaning edges
  - avoid polished rendering
  If the reference is clean:
  - cleaner outlines are acceptable

- `Palette`:
  Pull from canon first.
  If canon is incomplete, derive from theme rather than random preference.
  Prefer 2-4 strong dominant colors over many small accent colors.

## Reference Matching Rules

When the user asks for similarity to a specific reference image:

- first describe what actually drives the reference:
  - face-first vs outfit-first
  - simple vs dense
  - figurine-like vs illustrated
  - soft vs sharp
  - collectible/toy-like vs adventurer/utility-heavy
  - doll-like vs chibi proportions
  - youthful vs regal vs eerie vs aggressive emotional read
  - rough unfinished vs clean polished finish
- then bias the final prompt toward that structure
- if the previous generated result became too detailed, explicitly say so in the replacement prompt:
  - reduce costume complexity
  - reduce prop count
  - make the face more dominant
  - simplify the silhouette
  - simplify color blocking
- if the previous generated result became too polished, explicitly say so in the replacement prompt:
  - make the linework rougher
  - add scratchy overlapping sketch lines
  - keep visible construction
  - avoid clean final line art
  - avoid a finished render feel
- if the previous generated result became too chibi, explicitly say so in the replacement prompt:
  - avoid chibi proportions
  - avoid super-deformed head-to-body ratio
  - keep a figurine-like body with a readable torso and limbs
  - keep the face readable without turning the character into a mascot
- do not assume "more lore accuracy" means "more visual similarity"
- when canon and reference compete, preserve canon identity through a few strong cues, not through piling on accessories
- when multiple characters share the same style family, vary the emotional read and silhouette so they do not collapse into one interchangeable fantasy-elf default

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
- simple iconic design unless the reference clearly calls for more detail
- tailored to the character's canon appearance, role, props, motifs, and palette
