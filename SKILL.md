---
name: h3-director
description: Direct and compile production-ready MiniMax H3 audiovisual prompts and durable episode packages for short films, vertical dramas, commercials, and connected 4–15 second clips. Use when a user wants professional director reasoning, camera/blocking/action/lighting/performance/sound design, H3 T2VA/I2VA/FL2VA/L2VA/Ref2VA prompts, ComfyUI reference-image upload maps, grouped prompts and visual assets, browser-openable novel-art-style reports, multi-clip continuity, generated-take review, or one-variable H3 prompt repair.
---

# H3 Director

Turn a story beat into a directed shot contract, then compile only visible and audible decisions into the official MiniMax H3 prompt format. Keep director analysis outside the generation prompt.

## Dependency gate

Before drafting an H3 prompt:

1. Read `../h3-prompt-writing/SKILL.md` completely.
2. For T2VA, I2VA, FL2VA, or L2VA, read `../h3-prompt-writing/references/base-en.txt` completely.
3. For Ref2VA, read both `../h3-prompt-writing/references/base-en.txt` and `../h3-prompt-writing/references/ref-en.txt` completely.
4. Treat those files as the final authority for H3 field names, field order, labels, speaker IDs, dialogue tags, shot timing, and alignment instructions.

If the dependency is missing, stop prompt compilation and report the missing path. Never substitute Seedance syntax such as `@Image1` for H3 labels.

## Route the request

Classify the task before working:

- `new_clip`: direct one standalone 4–15 second generation.
- `sequence_clip`: direct one module inside a connected episode or campaign.
- `continuation`: begin from accepted footage's observed final state.
- `take_review`: inspect a generated clip and issue a verdict.
- `repair`: change one controlling variable after diagnosis.

Load these references as needed:

- Any narrative or performer-led clip: `references/directors-read-h3.md`.
- Shot design, camera, blocking, action, light, dialogue, or sound: `references/directing-engine-h3.md` and `references/h3-shot-and-action-language.md`.
- Any image, video, or audio reference: `references/h3-reference-authority.md`.
- Connected modules or continuation: `references/h3-sequence-continuity.md`.
- Returned take, failure diagnosis, or repair: `references/h3-retake-protocol.md`.
- Source and model-boundary questions: `references/provenance.md`.

## Intake

Recover known decisions from the conversation and project files before asking questions. Establish only what changes the result:

- story beat and intended endpoint;
- duration, aspect ratio, frame rate, and H3 mode;
- reference assets and what each must control;
- spoken language, exact dialogue, voice requirements, ambience, and music choice;
- previous accepted clip or final frame for continuation;
- known generation failures and user non-negotiables.

For a connected 15-second drama module, default to one main dramatic turn and no audience-only music (`non_diegetic_music: N/A`) unless the project bible or user requests a continuous score.

## Direct before compiling

For narrative work, complete the internal ten-field Director's Read in `references/directors-read-h3.md`. Do not paste its labels into the final H3 prompt.

Then write a shot contract containing:

1. one-sentence audience intention;
2. initial state, trigger, decisive change, response, follow-through, and local endpoint;
3. POV and screen direction;
4. subject blocking, weight, support, contact, eyeline, and one playable performance behavior;
5. one primary motivated camera move per shot, including endpoint;
6. motivated lighting sources and continuity;
7. dialogue timing, scene sound, action sound, breathing, and silence;
8. the final visual/audio state that the next clip can inherit.

Prioritize action legibility over spectacle. Simplify when identity, hands, contact, transformation, lip sync, or geography would otherwise compete for the same generation budget.

## Assign reference authority

Follow `references/h3-reference-authority.md` and give every asset one primary role. State what transfers and what must not transfer. Drop assets that own no required dimension.

For ComfyUI, output an explicit upload map:

| H3 label | File | Primary role | Do not transfer | Node input |
|---|---|---|---|---|
| `<Picture 1>` | absolute filename | environment/keyframe/etc. | excluded traits | `ref_image_0` |

Number H3 pictures from 1 while Comfy inputs begin at 0. Preserve that offset exactly.

## Compile the H3 prompt

Use the official dependency format without adding custom top-level fields.

- Base modes: emit the required alignment instruction, when applicable, followed by `integrated_multimodal_description`, `overall_soundscape`, and `non_diegetic_music`.
- Ref2VA: emit exactly `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music` in that order.
- Write rewrite prose in English. Preserve dialogue, lyrics, and visible scene text in their requested original language.
- Use stable `<Subject N>`, `<Picture N>`, `<Video N>`, `<Audio N>`, and `(Sx)` identities.
- Put only the language tag and exact spoken words inside `<d>...</d>`.
- Keep cut times strictly increasing and within the requested duration. Shot 1 has no cut timestamp.
- Put dialogue in the shot body, physical/ambient audio in `overall_soundscape`, and audience-only score in `non_diegetic_music`.
- Prefer concrete observable action to emotional adjectives and generic words such as “cinematic,” “epic,” or “dynamic.”

Run the structural validator after writing a prompt:

```powershell
python scripts/validate_h3_prompt.py <prompt.txt> --mode ref2va --duration 15
```

Fix every error. Review warnings with judgment; warnings are not automatic failures.

## Deliver

Unless the user requests prompt-only output, return four clearly separated objects:

1. **Director brief** in the user's language: function, turn, POV, action chain, camera/light/performance/sound intention, and endpoint.
2. **Asset upload map** with exact Picture order and ComfyUI inputs.
3. **H3 prompt** in one clean text block containing no commentary.
4. **Continuity handoff** with planned endpoint and, after review, observed endpoint.

When saving files, keep the prompt and asset map beside the clip's assets. Do not overwrite an accepted version; create a new version.

## Build an episode package

When the user asks for a season/episode deliverable, or asks to keep prompts and assets together, follow `references/episode-package.md`. Use one folder per episode with `prompts/`, categorized `assets/`, `upload-map/`, `continuity/`, and `report/`.

After prompt and asset decisions are accepted:

1. Run `scripts/validate_h3_prompt.py` for every prompt.
2. If the `novel-art` skill is available, render its `art.json` to Markdown and HTML before packaging. Preserve its `art-report.html` and `images/` directory under the episode's `report/` folder.
3. Run `scripts/build_episode_package.py` with the prompt directory, categorized asset roots, upload map, continuity file, and optional novel-art outputs.
4. Open `report/episode-report.html` locally and verify prompt counts, image previews, validator badges, download/copy buttons, and report links.
5. Return the episode folder path and the report path. The report is a navigation/QA surface; the clean prompt files remain the source of truth for H3.

The builder is deterministic and does not call a remote API. It copies local files, validates prompts with the bundled validator, and creates a self-contained HTML index. See `references/episode-package.md` for the contract and command.

## Continue from accepted footage

For sequences, follow `references/h3-sequence-continuity.md`. Planned state is provisional. Accepted footage's observed final state is canon. Never write the next prompt from a rejected take or from an unverified planned ending.

## Review and repair

Use `references/h3-retake-protocol.md` to issue exactly one verdict: `KEEP`, `POST-FIX`, `REROLL`, or `REWRITE`.

For `REROLL`, preserve accepted assets and change one primary variable only. For `REWRITE`, rebuild the shot contract before changing prompt prose. Record what changed and why.

## Quality gate

Before delivery, verify:

- the dramatic turn is visible, not merely described;
- camera movement has a narrative cause and a readable endpoint;
- body weight, support, contact, transformation, and object motion follow a clear chain;
- spatial axis, screen direction, vertical orientation, and environment identity remain stable;
- lighting comes from believable sources and remains continuous across cuts;
- one subject owns the focused action while others use restrained micro-motion;
- dialogue fits the available time and the mouth is visible when lip sync is requested;
- references do not conflict or leak unrelated wardrobe, faces, architecture, pose, or framing;
- the ending creates a usable state or hook for the next module;
- the final prompt passes `validate_h3_prompt.py`.


