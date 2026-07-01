# Home Field Agent Flow

Date: 2026-05-23

This workflow prevents one agent from generating, validating, and approving its own Home Field art. Use it for terrain generation runs, starting with the grass-family batch. For the broader runtime-readiness plan, follow [`docs/home-field-runtime-asset-contract-plan.md`](home-field-runtime-asset-contract-plan.md) alongside this flow.

## Core Rule

No single role may both create an image and approve it. Generation, mechanical validation, and visual review are separate stages.

Before any Home Field imagegen run, read [`docs/home-field-imagegen-requirements.md`](home-field-imagegen-requirements.md). It is the shared imagegen contract for file-output gating, candidate isolation, provenance, prompt content, runtime-readiness evidence, prompt-issuance gates, and handoff shape. Family-specific docs add stricter rules. If the target family has a preflight command, run it before spawning generation/review sub-agents or reading the full reference stack; a failed preflight is a clean stop except for the one same-context diagnostic built-in output probe defined in the imagegen requirements, and that probe is allowed only when reference-image input binding is already confirmed and disk output is the remaining blocker. Do not give the user a fresh production-run prompt that is known to hit a blocked queue item unless the prompt also supplies or points to a concrete allowed unblock input. For the current Thalla queue item, the supplied complete `8x4` local state-sheet source is the queue JSON `generationContract.stateSheet.localSourceMode.sourcePath`; use the queue-printed `--source` commands for preflight/archive/stage. A different supplied local state-sheet PNG must be passed explicitly with `--source` or recorded in the queue source path.

If the environment supports sub-agents, assign Prompt/Contract Reviewer, Imagegen Worker, Producer/Validation Worker, and Visual Critic as separate agents. A single read-only sidecar is not enough for a generation run. The Imagegen Worker may run imagegen only when that exact agent context has confirmed discoverable PNG output and, for current Thalla proof art, can attach or stage the checked-in reference PNGs as actual same-context image inputs. For built-in imagegen, `view_image` may be used as the current imagegen skill's local-file input-staging step only when the following built-in `image_gen` call explicitly uses those visible images as references; passive viewing alone is not image-guided generation. Otherwise keep imagegen in the context that can save/recover files and use sub-agents for contract review, validation, and visual criticism, or stop if no reference-capable path exists. In supplied complete local state-sheet mode, there is no Imagegen Worker stage: the Producer/Validation Worker stages the supplied PNG, derives the reference proxy, and the Visual Critic reviews the staged source/candidate evidence. If sub-agents are unavailable, the active agent must still execute the stages separately and name which role it is acting as in its notes.

When using the multi-agent tool, use the known-good call shape only:

```json
{"agent_type":"explorer","message":"<bounded role, read/write scope, exact completion condition>"}
```

Do not pass `fork_context` or mixed `message`/`items` payloads; those have caused avoidable retries in prior Home Field runs.

## Roles

| Role | May read | May write | Must not do |
| --- | --- | --- | --- |
| Orchestrator | Workflow docs, command output, final reports | Commit and push approved candidate-batch changes | Generate images, approve art by itself, skip stop gates |
| Prompt/Contract Reviewer | Assets, prompts, style anchor, tileset contract, runtime asset contract, rerun output | Nothing | Generate images, edit manifests, approve art |
| Imagegen Worker | Prompt blocks and style anchor | Raw PNGs under `.agent/home-field-workspace/raw/` | Edit app PNGs directly, edit JSON/docs, approve art |
| Producer/Validation Worker | Raw files, manifest, command output | Candidate PNGs under `.agent/home-field-workspace/candidates/`; generated local review sheets | Hand-edit PNGs, change contracts, overwrite app-facing PNGs before human approval, approve art |
| Visual Critic | Final candidate evidence manifest, contact sheet, adjacency sheet, clean preview screenshots | `docs/home-field-asset-review.json` verdict/check rows for the active batch only | Start before final evidence exists, set `approved` or `accepted: true` without explicit human approval |

For chibi runs, the Prompt/Contract Reviewer must state a palette plan before the Imagegen Worker starts: `12-18` artist-visible colors, fewer than `20` total design colors, transparency and `#ff00ff` excluded, and shared cap/robe/skin/gold ramps instead of many near-duplicate local shades. The same note must state the style-preservation plan: preserve the compact grouped-sheet charm from `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png` while fixing palette bloat and ornament. It must also state the scale/face/biology plan: tiny source-sprite views for `64px` output, small dark seed/dot eyes rather than glossy anime eyes, and mushroom cap as biology rather than hair/wig under a hat. It must also state the status-simplification plan: Thalla's authority reads through cap silhouette, robe blocks, posture, and `1-2` flat mycelium/spore marks only, not royal/regalia wording, crown jewels, forehead gems, brooches, medallions, pendants, jewelry-like cap crests, gold filigree, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, or repeated gold badges. This is a run note/checkpoint, not a new PNG artifact.

## Minimal Production Scene Gate

When the goal is a production-looking Home Field v1, use [`docs/home-field-minimal-production-plan.md`](home-field-minimal-production-plan.md) instead of running isolated asset-family polishing. The run target is one coherent composed field candidate with quiet grass, entrances, a few props, and Thalla at correct field scale.

The primary acceptance evidence is the clean composed scene:

```bash
npm run game:home-field:combined-candidate-preview
```

The Visual Critic must review `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png` and `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png` before treating contact sheets as supporting evidence. If those screenshots show visible square terrain cells, pasted path bands, mismatched prop scale, wrong chibi camera, or mixed renderer styles, the candidate fails even when mechanical validators pass.

Path is optional for this v1 gate. If the shared-source path family fails to blend into the grass baseline twice, defer path and continue with a grass-first scene plus destination/entrance placement rather than extending the run.

## Grass-First Gate

The next tile generation run is limited to:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`

`npm run game:home-field:next-tiles` is the gated first-pass queue. Once a grass candidate is marked `needs_review`, that command can block to prevent accidental continuation for grass-only terrain runs. For the minimal production scene plan, grass is a checkpoint rather than a final stop: continue into path, object-layer, and Thalla work only after the clean grass preview is usable.

For intentional grass-family reruns, use the shared-source queue:

```bash
npm run game:home-field:rerun-grass-family
```

That command emits one shared meadow-source prompt for the three grass rows. The Imagegen Worker must generate a larger continuous meadow/pattern context and save only `.agent/home-field-workspace/raw/grass_family_meadow.source.png`. The Producer/Validation Worker then runs:

```bash
npm run game:home-field:produce-grass-family-candidate
```

Do not generate or save separate per-tile raw PNGs for this grass batch. The family producer crops coordinated nearby regions from the same source and normalizes crop average color/value so `grass_base_01`, `grass_base_02`, and `grass_flowers_01` share lighting, brushwork, and value range. Candidate mode writes to `.agent/home-field-workspace/candidates/grass-family/latest/`; it must not overwrite `web/public/home-field/terrain/` before explicit human approval.

The default crop plan is `tight-center`. If visual review still shows square value boundaries, the Producer/Validation Worker may rerun the same raw source with `--plan=lower-band` or `--plan=upper-band`. If those still show visible columns, use `--plan=unified-base`; that fallback keeps all tile edges from one quiet crop and blends variations only inside the tile. If the source itself has broad bands or noisy tile edges, use `--plan=flat-minimal` for the fastest production-safe grass baseline: source-paletted simple grass with uniform edges and tiny interior marks. Regenerate evidence and let the Visual Critic choose the best non-approved candidate before commit. Do not commit multiple crop-plan attempts.

Grass-only terrain runs must stop after these three candidates are produced and reviewed. Minimal production scene runs may proceed into path/landing, props, entrances, and Thalla after the grass baseline is selected as usable for the current candidate.

## Path And Edge Family Gate

After the grass family is human-approved or explicitly selected as the active candidate baseline, path and edge terrain must be generated as terrain-family candidates, not app-facing PNGs. For the minimal production scene plan, "selected" can mean selected as the temporary candidate baseline for this run; it does not mean production approval.

Use the family queues:

```bash
npm run game:home-field:rerun-path-family
npm run game:home-field:rerun-edge-family
```

`rerun-path-family` emits one shared-source prompt for the path family. The Imagegen Worker must generate only `.agent/home-field-workspace/raw/path_family_strip.source.png`, not separate per-tile raw PNGs. The Producer/Validation Worker then runs:

```bash
npm run game:home-field:produce-path-family-candidate
```

The path producer crops the west end, straight path, glow path, east end, and destination landing from the same source so camera, dirt band, palette, and brushwork stay locked. Do not use independent per-tile path imagegen unless this shared-source path fails technically and the user explicitly asks for diagnostics.

`rerun-edge-family` still prints candidate-safe per-tile prompts and producer commands that write under `.agent/home-field-workspace/candidates/terrain-family/latest/`. Do not use plain `game:home-field:produce` for path or edge reruns before human approval.

Required path-family scope:

- `path_h_end_w`
- `path_dirt_straight`
- `path_spore_glow`
- `path_h_end_e`
- `path_destination_row`

If the path family is deferred after two failed blend attempts, mark `path_h_end_w`, `path_dirt_straight`, `path_spore_glow`, and `path_h_end_e` as deferred or `needs_regen` in review notes. `path_destination_row` may remain in scope as a subtle destination landing only if it blends into the grass and entrance placement; otherwise defer it with the rest of the path family. When path is deferred, run terrain evidence only for the grass IDs plus any retained `path_destination_row` candidate.

For grass-first scene proof with path deferred, run the clean preview with `HOME_FIELD_DEFER_PATH=1`. This routes the path public URLs to the current grass-family candidate only inside the Playwright candidate preview; it does not change the map or app-facing assets.

Required edge-family scope:

- `edge_roots_01`
- `edge_moss_rocks_01`
- `edge_left_forest_01`
- `edge_right_forest_01`

The Visual Critic must review each family as one set. A path family fails if the dirt band, glow band, end fades, or destination landing use different camera, palette, edge values, or Y-band reads. An edge family fails if side stacks feel like unrelated forest strips, cropped full scenes, or a different zoom level from the grass/path baseline.

The Visual Critic must wait until the Producer/Validation Worker has passed every required command for the current raw source hash and has regenerated the candidate evidence manifest. If the producer regenerates the shared source after a failed check, any earlier visual verdict is stale and must be redone from the latest contact sheet, adjacency sheet, evidence manifest, and mobile/desktop clean previews.

Minimum evidence:

```bash
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:validate -- --ids=<family_ids> --check-files --check-connectors --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:validate -- --ids=<family_ids> --check-files --check-edge-profiles --check-family-cohesion
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:adjacency
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest HOME_FIELD_CANDIDATE_IDS=<family_ids> npm run game:home-field:candidate-evidence
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest HOME_FIELD_CANDIDATE_IDS=<family_ids> npm run game:home-field:terrain-candidate-preview
```

Before any production approval, run the combined scene proof:

```bash
npm run game:home-field:combined-candidate-preview
```

Use `HOME_FIELD_CANDIDATE_ROOTS` and `HOME_FIELD_CANDIDATE_IDS` if the latest accepted candidate folders differ from the defaults.

Before path promotion specifically, inspect the path candidate together with the current grass candidate/baseline in `game:home-field:combined-candidate-preview`. A path family can be internally coherent and still fail production if the path tiles look pasted onto the grass field.

## Object-Layer Candidate Gate

For prop/exit review runs, use the generic candidate producer instead of the promotion producer. The same object-layer candidate root may contain both `props/` and `exits/` app-path subfolders, matching each asset's manifest output path.

```bash
OBJECT_IDS=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01,mushroom_cluster_small_amber,mushroom_cluster_small_violet,mushroom_cap_red_spotted,fallen_branch_mycelium,arena_mushroom_arch,journey_gate_under_construction
npm run game:home-field:produce-object-candidate -- ${OBJECT_IDS//,/ } --resize --chroma-key=#ff00ff
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=$OBJECT_IDS --check-files --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=$OBJECT_IDS --check-files --check-alpha-halo
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=$OBJECT_IDS --check-files --check-readability
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=$OBJECT_IDS --check-files --check-runtime-readiness
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:mobile-readability-sheet -- --ids=$OBJECT_IDS
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:alpha-sheet -- --ids=$OBJECT_IDS
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/object-layer/latest HOME_FIELD_CANDIDATE_IDS=$OBJECT_IDS npm run game:home-field:object-candidate-preview
```

This writes candidate PNGs under `.agent/home-field-workspace/candidates/object-layer/latest/web/public/home-field/` using each asset's normal app-facing subfolder (`props/`, `exits/`, and so on), and uses route interception for `/home-field-preview?debug=0`, so app-facing PNGs remain untouched before human approval. If a run covers a different prop/exit set, pass `--candidate-root=<dir>` to `game:home-field:produce` and set `HOME_FIELD_CANDIDATE_IDS` / `HOME_FIELD_CANDIDATE_ROOT` when running the candidate preview spec.

## Active-Roster Chibi Candidate Gate

For active-roster chibi runs, follow [`docs/home-field-chibi-candidate-contract.md`](home-field-chibi-candidate-contract.md). The first scoped proof id is:

- `thalla`

This batch is candidate-only. Do not overwrite `web/public/home-field/characters/*/spritesheet.png`, do not mark rows approved, and do not set `accepted: true`.

Stage 1 is not a full-animation polish run, but it now uses the full runtime sheet shape so the proof can catch style drift across real idle/walk states. Generate one coherent `8x4` grouped state sheet, split it into `32` canonical raw frame slots, and compose the locked `512 x 256` runtime sheet from those chunks. Idle columns `0-1` must be a real normal-to-little-bob pair in the grouped sheet itself. Walk columns `2-7` should target `4` meaningful poses with optional holds/in-betweens, and at least `3` unique walk frames per direction must survive validation.

Use a two-step character consistency flow. First run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof`, then `npm run game:home-field:next-chibi-proof`, and use its copyable reference prompt exactly for the non-production sprite-box reference sheet under `.agent/home-field-workspace/reference/`; do not hand-compose or add extra style terms. The structured queue item owns per-asset references, env-file rules, output paths, commands, stop gates, method-gate status, prompt-issuance policy, final-response fields, local-source `sourcePath`, and the short agent-instruction block that fresh runs must follow before choosing an image path. Current Thalla runs must use the checked-in PNG references as actual same-context image inputs to imagegen, not another text-only reference attempt and not passive images viewed by the agent: `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png`, `docs/reference/home-field/chibi-thalla-liked-2026-06-23.png`, and `docs/reference/home-field/chibi-style-agent-log-reference.png`. Listing filesystem paths to those PNGs is still text-only; if the active imagegen path cannot attach or use those checked-in PNGs as actual same-context image inputs to the generation call, stop and report that image-guided generation is required. After rollout `codex-019f1eb1-1027-7752-95cf-d4f37cb0041c`, do not run the queue-backed built-in same-context reference-staging path again unchanged. It used same-context `view_image` staging of all three reference PNGs, a same-context built-in `image_gen` call with the visible images named as references, and save/claim handoff, but still failed the reference verifier and palette audit with an oversized soft turnaround. The built-in staging method is exhausted for unchanged Thalla proof runs. Continue only with a different reference-capable generation/editing path, supplied local proof source PNGs, the queue-owned supplied complete local state-sheet source path, or explicit user-approved fallback; otherwise stop and report the blocker. Do not turn that blocked state into another "new production-ready run" prompt unless the prompt includes or points to one concrete allowed unblock input. For the current supplied complete local state-sheet run, use `.agent/home-field-workspace/supplied/thalla_tetro_cleaned_2026-06-30.states.source.png` with the queue-printed `--source` commands for preflight/archive/stage. A different supplied complete `8x4` local state-sheet PNG must be passed explicitly with `--source` or recorded in the queue source path; the checked-in `docs/reference/home-field/` PNGs are not valid proof sources. For paid API fallback, use `npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>`, `npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>`, and `npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>` instead of manual env discovery or ad hoc venv setup. Do not infer `.env`; rollout `codex-019f1dbd-e6dd-70e0-a7fe-53977b1cc831` correctly blocked after the guessed env file lacked the required fallback environment. Paid API fallback requires `OPENAI_IMAGEGEN_API_KEY` and `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`; plain `OPENAI_API_KEY` is ignored for image generation. The helper extracts the exact prompt from `next-chibi-proof`, calls `image_gen.py edit` with the three checked-in PNGs as real image inputs, writes a preserved API-size source PNG, normalizes it to the `512x384` sprite-box reference, and then runs the reference verifier and palette audit serially with palette bloat as a hard blocker. The reference must show Thalla in `down`, `up`, `left`, and `right` with one consistent design and must read as tiny source-sprite art inside invisible `96x96` boxes that will downscale to `64px`, with most of the sheet left as empty `#ff00ff`, not as enlarged character-design showcase art, quadrant-filling anime turnaround art, or soft painterly turnaround figures. Prefer a compact source canvas around `512x384` or smaller; a larger API-required source such as `1024x768` may be normalized to `512x384` before the reference verifier, but normalization is not style approval and the palette audit plus visual gate must still pass. Run `npm run game:home-field:verify-chibi-proof-files -- --reference` and `npm run game:home-field:palette-audit -- ... --fail-on-bloat` on the saved reference before deciding whether to continue. The helper is reference-only: after the reference passes, generate the final states as one coherent grouped `8x4` source sheet through a reference-capable image path with the approved reference PNG attached as an actual image input. If only prompt-text state-sheet generation is available, stop instead of producing another drift-prone candidate. Run the same palette audit on the grouped state sheet, then split it into isolated transparent raw frames with the checked-in splitter. The reference sheet is allowed for visual consistency only; do not slice it into production raw frames.

Before regenerating after a rejected chibi run, run preflight first. For the paid API fallback route, pass the same `--env-file=<explicit-env-file>` to preflight, archive, and reference generation; the file must contain `OPENAI_IMAGEGEN_API_KEY` and `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`. If built-in output is the intended path and only disk capture is unconfirmed while reference-image input binding is already confirmed, run the one diagnostic non-candidate probe from the shared imagegen requirements and rerun preflight with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` plus `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` only when the bounded locator finds a newer file. If reference binding is unavailable, stop before the probe because it proves file capture only. If preflight or the current method gate blocks the run, still run the read-only `npm run game:home-field:next-chibi-proof` helper before final handoff so the scoped prompt, reference-image list, and active blocker are captured; do not archive stale files, run imagegen, or produce candidates. Only after preflight passes, archive stale `thalla_chibi*.source.png` raw files, stale reference sheets, and stale `.agent/home-field-workspace/candidates/chibi-active-roster/latest/` output with `npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>` for API fallback runs or with the same confirmed built-in/local capability context. Existing rejected raw frames are negative examples, not reusable generation inputs. Stop after the sprite-box reference sheet and inspect it before creating final raw frames; if the reference already misses the style, regenerate the reference first. For built-in outputs outside the repo, claim reference/state-sheet files with `npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>`.

For Stage 1, ignore the legacy single manifest `sourcePath` (`.agent/home-field-workspace/raw/thalla_chibi.source.png`) as a production raw input. It is not sufficient for this contract. The producer must consume the isolated raw frame files named in `docs/home-field-chibi-candidate-contract.md`.

For current same-character chibi candidates, final raw frames should come from one coherent grouped `8x4` source sheet, not from 32 separate imagegen calls. The splitter must produce isolated transparent `64x64` raw frame chunks; the grouped source sheet itself may be a larger proportional image when split with `--resize`. The grouped state sheet is also the source of truth for pose and motion: idle bob/squish and walk poses must already exist in that image. Post-split deterministic processing may clean alpha/chroma fringe, crop, and resize only; it must not synthesize motion by shifting frames or alter pose, silhouette, style, or identity. The Visual Critic must fail `sourceFrameIsolationCheck`, `sheetMappingCheck`, and `stageContractCheck` if any split raw image contains multiple sprites, borders, a background, cropped sheet artifacts, missing idle bob, or post-split pose/motion edits. A sprite-box reference sheet must not be treated as the final production source.

Use smooth `--resize` for production chibi candidates generated from larger isolated frames. Do not use `--resize-nearest`; hard pixel stair-steps and crisp pixel-sprite edges are style failures for the hand-drawn Home Field chibi target.

The Stage 1 camera target is an elevated top-down 2.5D hub sprite: show some top of the mushroom cap/head, keep feet/base planted on the map, and avoid straight-on portrait-sticker or fashion-pose reads. Detail must be aggressively budgeted for mobile: broad shapes, `2-3` main color regions, `1-2` gold mycelium/spore marks, tiny facial features only, and no ornate filigree or particle halo.

Palette checkpoint: before generating the reference sheet, the Imagegen Worker should be operating from the explicit palette plan above. Stop at the reference gate if the turnaround already looks like a soft illustration palette, uses many cream/beige/blush/gold micro-tones, or appears to exceed roughly `20` visible design colors. Also stop if the palette rule has been overcorrected into hard pixel art, clean vector/cel icon art, a large flat anime/fashion/showcase turnaround, quadrant-filling character art, glossy anime eyes, eyelashes, hair/wig under a mushroom cap, earrings/jewelry styling, royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, repeated gold badges, or a cold "exactly 16 swatches" exercise that loses the previous-best compact charm. Review the final grouped state sheet and composed candidate the same way. Use `game:home-field:palette-audit` to generate JSON and swatch evidence, but keep the decision visual: raw unique-RGBA count after antialiasing or resize is diagnostic only. If palette bloat, palette overcorrection, or status-ornament drift is visible, the Visual Critic must fail `styleCohesionCheck` and `stageContractCheck`, set `verdict: "needs_regen"`, and name the palette/style failure in `reason`.

Required Thalla palette evidence commands:

```bash
npm run game:home-field:palette-audit -- .agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --out=.agent/home-field-workspace/review/thalla-reference-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-reference-palette-swatch.png --fail-on-bloat
npm run game:home-field:palette-audit -- .agent/home-field-workspace/raw/thalla_chibi.states.source.png --out=.agent/home-field-workspace/review/thalla-state-sheet-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-state-sheet-palette-swatch.png --fail-on-bloat
npm run game:home-field:palette-audit -- .agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png --out=.agent/home-field-workspace/review/thalla-candidate-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-candidate-palette-swatch.png --fail-on-bloat
```

For chibi candidates, `candidate-evidence.manifest.json` must bind those audit JSON files and swatches and verify each audit's `source.sha256` against the current PNG; if they are missing or stale, regenerate the palette audits before visual review.

For palette tooling and cleanup experiments, read [`docs/home-field-chibi-palette-cleanup-research.md`](home-field-chibi-palette-cleanup-research.md). A Retro/Tetro-style cleanup or deterministic palette remap may be useful for diagnostics, but it must not be promoted to candidate evidence unless the same visual gate passes. Palette cleanup cannot excuse hair/wig reads under the cap, glossy anime eyes, ornamental status details, or large turnaround composition.

If two exact-prompt image-guided reference attempts fail the same palette/style/status-ornament gate, stop and report the repeated reference-gate blocker instead of spending more blind retries. A third attempt is allowed only after the persisted prompt/helper changes or the user explicitly asks to try anyway. Do not fall back to text-only reference attempts; repeated 2026-06-28 runs proved text-only Thalla references still produce oversized anime/turnaround art, the earlier 2026-06-29 run proved the old turnaround wording still produced large painterly character-sheet figures after references were only loaded for viewing, and the later 2026-06-29 run proved view-only references are not actual imagegen input binding.

For the minimal production-candidate plan, after Thalla passes review, expand only to `lomie` if the composed scene still needs a second chibi; stop there. Full-roster expansion to `lomie`, `axilin`, `kirt`, and `dalamar` belongs to a later non-minimal stage. Keep `morga` deferred until her design contract is explicit enough for production chibi generation.

Review evidence for this batch should live under:

- `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`
- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/mobile-readability-sheet.png`
- `.agent/home-field-workspace/review/thalla-reference-palette-audit.json`
- `.agent/home-field-workspace/review/thalla-reference-palette-swatch.png`
- `.agent/home-field-workspace/review/thalla-state-sheet-palette-audit.json`
- `.agent/home-field-workspace/review/thalla-state-sheet-palette-swatch.png`
- `.agent/home-field-workspace/review/thalla-candidate-palette-audit.json`
- `.agent/home-field-workspace/review/thalla-candidate-palette-swatch.png`
- `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`

The Visual Critic updates only the scoped character rows in `docs/home-field-asset-review.json`; for Stage 1, that means `thalla` only.

## Scene Target Gate

The target is not an isolated grass texture. The final composed field should read like a polished game-hub screenshot: chibi mushroom-elf avatars standing on a soft green meadow, with chunky dark-ink foliage, vines, flowers, mushrooms, exits, and props framing the walkable area on object layers.

Before any terrain, prop, exit, effect, or chibi generation, follow [`docs/home-field-imagegen-requirements.md`](home-field-imagegen-requirements.md), [`docs/home-field-scale-contract.md`](home-field-scale-contract.md), and the implementation plan in [`docs/home-field-runtime-asset-contract-plan.md`](home-field-runtime-asset-contract-plan.md). The source canvas size is not the visual footprint: `256x256` props should not fill the whole source canvas unless they are terrain, and larger source sizes are for cleaner alpha/cropping rather than extra tiny detail. Reject any batch where assets look like different zoom levels, camera angles, renderers, or lighting setups in the same Home Field preview.

For the grass batch, this means:

- grass must be quiet enough that 64px chibi feet and shadows stay readable;
- tiny grass strokes and yellow-green marks are accents only, not a texture carpet;
- flowers and strong foliage shapes belong mostly on object-layer props, not base terrain;
- the three grass tiles must look like crops from the same meadow source, not unrelated imagegen outputs;
- the clean preview must feel like a usable stage for characters, even before the real chibi sprites are replaced.

## Required Evidence

Before any grass candidate can be considered for human approval, the run must produce:

- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:validate -- --ids=grass_base_01,grass_base_02,grass_flowers_01 --check-files --check-connectors --check-review`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:sheet`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:grass-family-sheet`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:adjacency`
- `HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/grass-family/latest HOME_FIELD_CANDIDATE_IDS=grass_base_01,grass_base_02,grass_flowers_01 npm run game:home-field:candidate-evidence`
- `npm run game:home-field:candidate-preview`

Review evidence lives locally under:

- `.agent/home-field-workspace/candidates/grass-family/latest/`
- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/grass-family-sheet.png`
- `.agent/home-field-workspace/review/adjacency-sheet.png`
- `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`
- `.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/` after human-approved promotion

Do not commit `.agent` review artifacts.

Run `game:home-field:candidate-preview` before visual review. It uses Playwright route interception to render `/home-field-preview?debug=0` with the candidate grass PNGs from `.agent/home-field-workspace/candidates/grass-family/latest/`, without promoting or overwriting app-facing PNGs. The app-facing clean preview screenshots under `.agent/tasks/...` remain post-promotion proof.

Run `game:home-field:object-candidate-preview` for the foliage micro-batch. It uses the same clean preview screenshot paths, but routes `bush_cluster_dark_01`, `bush_cluster_light_01`, and `leaf_sprout_01` from `.agent/home-field-workspace/candidates/object-layer/latest/`.

## Review JSON Rules

The Visual Critic updates only the active batch rows in `docs/home-field-asset-review.json`. It must refresh every required check field for each active row, not only the prose `reason`.

Required fields:

- `repeatCheck`
- `connectorCheck`
- `cleanPreviewCheck`
- `sceneFitCheck`
- `familyCohesionCheck`
- `styleCohesionCheck`
- `alphaCheck`
- `scaleCheck`
- `verdict`
- `accepted`
- `reason`

Recommended evidence fields before any human approval:

- `candidateRoot`
- `candidateEvidenceManifest`
- `candidateSha256`
- `rawSourceSha256`
- `mobileScreenshotSha256`
- `desktopScreenshotSha256`

For chibi Stage 1 candidates, `candidateEvidenceManifest` must bind more than the composed candidate sheet. It must include the non-production sprite-box reference, the grouped `8x4` state sheet as `rawSource`, and the 32 split frame files with a frame-set hash. In supplied complete local state-sheet mode, the non-production reference may be the deterministic proxy derived by `npm run game:home-field:stage-chibi-local-source`, and the handoff must include `.agent/home-field-workspace/review/thalla-local-state-sheet-source.manifest.json` with the supplied source hash. A chibi manifest with `rawSource: null` is incomplete evidence and must be regenerated before visual review.

For chibi palette failures, do not add a separate review field. Record the failure through existing checks: `styleCohesionCheck: "fail"` for soft/illustration-palette drift and `stageContractCheck: "fail"` when the candidate misses the documented `<20` visible design-color contract. The `reason` must say whether the palette problem was already present in the reference, emerged in the grouped state sheet, or only became obvious in the composed mobile/desktop preview.

Allowed non-human verdicts:

- `needs_review`
- `needs_regen`
- `rejected`

Human-only approval:

- `verdict: "approved"`
- `accepted: true`

An approved row must have all checks set to `pass` or `not_applicable`.

## Failure Handling

- If imagegen returns a full scene, dense texture, path, prop, text, horizon, or focal object inside a grass tile, discard the raw and regenerate.
- If the shared meadow output still shows repeated square blocks, diagonal mottling, columns, rows, hard value bands, or visibly different zones in the contact sheet or clean preview, mark it `needs_regen`. Passing file and connector validation is not enough.
- If the clean preview does not look like a calm stage where chibi avatars and object-layer foliage can sit naturally, set `sceneFitCheck` to `fail` even if the tile is technically seamless.
- If the mobile or desktop clean preview shows visible square tile boundaries, pasted candidate blocks, or a path/destination patch that does not blend into the surrounding grass, set `cleanPreviewCheck` to `fail`. Do not mark it `pass` just because connector, edge-profile, or family-cohesion validation passed.
- If the grass variants do not share lighting, brushwork, and value range, set `familyCohesionCheck` to `fail`.
- If produce fails, rerun only the affected asset with the printed producer command.
- If `tight-center` produces blocky family transitions, try at most the two documented alternate crop plans from the same raw source, refresh `grass-family-sheet`, and commit only the best candidate set.
- If validation fails because a contract changed, stop and report. Do not edit validators or manifests during a generation run.
- If any validator or proof command fails and the run later recovers, the final handoff must explicitly name the first failed command, the failure summary, the recovery action, and the final passing command/log. Do not collapse a recovered failure into a simple all-pass summary.
- If `--check-edge-profiles` fails, inspect the adjacency sheet before retrying. The heuristic is allowed to be conservative, but visible path-band, grass-edge, or edge-stack seams must be regenerated rather than papered over with metadata.
- If `--check-family-cohesion` fails, treat it as a warning that the tiles may be separate-looking paintings even when edge profiles pass. Inspect the contact, adjacency, and mobile/desktop clean previews; regenerate from one shared source if the family drift is visible.
- If `--check-alpha-halo` reports visible chroma fringe, reprocess with stricter chroma-key cleanup or regenerate the affected raw PNG. Do not leave `alphaCheck: pending` on a candidate whose halo validator fails.
- If `--check-readability` fails, regenerate or reprocess the candidate so the visible alpha bounding box meets the asset's `readability` minimums. Do not compensate by scaling objects with CSS in the preview.
- If a bush candidate looks like many repeated round clumps, broccoli/cauliflower crowns, flower rosettes, or obvious brush stamps instead of one irregular natural shrub mass, set it to `needs_regen` even if alpha, scale, and field screenshots pass.
- If a bush candidate is constructed from many visible leafy segments or mini-crowns, set it to `needs_regen`. The target is a few large overlapping foliage masses, not a collection of many small shrub pieces.
- If a light foliage candidate reads bright yellow/lemon and pulls attention from the chibi/path area in the mobile clean preview, set `sceneFitCheck` and `styleCohesionCheck` to `fail` even if shape/readability pass.
- If an object-layer prop loses its main identity at 48-64px in `mobile-readability-sheet.png` or in the mobile clean field screenshot, set `scaleCheck` or `cleanPreviewCheck` to `fail`. Passing the 256px contact sheet is not enough.
- If a field prop only looks good as a large 256px contact-sheet illustration, set `scaleCheck` to `fail`. In the current DOM preview, small scene props render at roughly 52x52 CSS pixels on the 375x667 mobile viewport and roughly 90x90 CSS pixels on desktop, with the visible alpha shape often only 30-48px wide on mobile. Dense gills, many spots, tiny caps, root tangles, bark chips, fine veins, and glossy hero-object rendering are review failures for these props.
- If a chibi reference, grouped state sheet, or composed candidate looks like it uses more than roughly `20` visible design colors, or solves softness with many near-duplicate beige, cream, blush, glow, or gold tones, regenerate from the palette plan. Do not try to make a bloated chibi compliant by post-split quantization or palette crushing; that is a diagnostic experiment only and not a production candidate.
- If a chibi reference or state sheet fixes palette bloat by becoming hard pixel art, clean vector/cel icon art, a large anime/fashion turnaround, quadrant-filling character art, or a generic flat doll with earrings/jewelry, mark `styleCohesionCheck` and `stageContractCheck` fail. Palette reduction must preserve the previous-best compact field-sprite charm.
- If a Thalla chibi reference or state sheet turns authority/status into royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, gold filigree, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, or repeated gold badges, mark `styleCohesionCheck` and `stageContractCheck` fail. Status must read from silhouette/posture/robe blocks and `1-2` flat mycelium marks.
- Intentional vegetable or strange-flower references are allowed only for assets with `role: "funny_foliage_prop"` such as `mutant_broccoli_bush_01`; do not use that allowance to approve accidental broccoli shapes in natural `bush_cluster_*` assets.
- If visual review fails, set the active rows to `needs_regen` or `rejected`, leave app-facing PNGs untouched, commit the review manifest if it changed, and stop.
- If visual review passes as `needs_review`, stop and ask for human approval before promoting candidate PNGs to app-facing paths.
- If visual review is waiting for human approval but has any remaining visual caveat, prefer `needs_review` with the affected check left `pending` or `fail`; reserve all-pass rows for candidates the Visual Critic would be comfortable promoting after explicit human approval.
- Every candidate run must update `docs/home-field-asset-review.json` with a per-asset visual verdict for the generated IDs. Do this even when the verdict remains `needs_regen`; fresh evidence with stale reasons/checks is a failed handoff.

## Handoff Report

Every generation run ends with:

```text
Grass tile candidate batch complete.
Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)
Committed assets: <none unless human approval promoted the candidate>
Review evidence:
  Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)
  Contact sheet: .agent/home-field-workspace/review/contact-sheet.png
  Grass family sheet: .agent/home-field-workspace/review/grass-family-sheet.png
  Adjacency sheet: .agent/home-field-workspace/review/adjacency-sheet.png
  Mobile readability sheet: [mobile readability sheet](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/mobile-readability-sheet.png)
  Candidate field mobile: [mobile field screenshot](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png)
  Candidate field desktop: [desktop field screenshot](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png)
  Clean preview screenshots: <only after human-approved promotion>
Review verdicts:
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
Notes:
  <retry/rejection/remaining issue summary>
  Recovered validation failures: <none | failed command -> recovery action -> final passing command/log>
```

For chibi runs, the handoff must also name `npm run game:home-field:next-chibi-proof` in the command list. If the run stops at the reference gate, explicitly say that grouped state-sheet generation, split-frame verification, candidate production, candidate evidence, candidate preview, and `record-chibi-verdict` were not run because no candidate manifest exists yet.

Do not wrap the candidate folder or candidate field screenshot paths in backticks in the final response. They must be Markdown links so the reviewer can open them from Codex Desktop.
