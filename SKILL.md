---
name: h3-director
description: Direct and compile production-ready MiniMax H3 audiovisual prompts for short films, vertical dramas, commercials, and connected 4鈥?5 second clips. Use when a user wants professional director reasoning, camera/blocking/action/lighting/performance/sound design, Chinese H3 prompt prose with original-language overseas dialogue, H3 T2VA/I2VA/FL2VA/L2VA/Ref2VA prompts, ComfyUI reference-image upload maps, real-frame multi-clip continuity, generated-take review, or one-variable H3 prompt repair.
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

- `new_clip`: direct one standalone 4鈥?5 second generation.
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

## Prompt language policy

Default the compiled H3 prompt's narrative and directing prose to **Chinese** unless the user explicitly requests another prompt language. This is a language choice, not a schema change: keep the official H3 top-level field names, field order, reference labels, speaker IDs, timing syntax, and dialogue tags exactly as required by `h3-prompt-writing`.

For an overseas production, keep every spoken line in the script's original **English** inside `<d>[English] ...</d>`. Preserve the approved wording and speaker; do not translate it into Chinese, paraphrase it, or invent a replacement merely to match the Chinese prompt prose. If the source script supplies only Chinese dialogue and the user has not approved an English adaptation, stop and flag the missing approved English line rather than silently rewriting it.

Use Chinese for subject definitions, summary, retention instructions, shot direction, camera, lighting, and sound descriptions. Use the official H3 labels such as `<Subject 1>` and `<Picture 1>` unchanged. The prompt may therefore be bilingual by design: Chinese production instructions plus original-language dialogue.

## Compile the H3 prompt

Use the official dependency format without adding custom top-level fields.

- Base modes: emit the required alignment instruction, when applicable, followed by `integrated_multimodal_description`, `overall_soundscape`, and `non_diegetic_music`.
- Ref2VA: emit exactly `subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, and `non_diegetic_music` in that order.
- Write rewrite prose in Chinese by default. Preserve dialogue, lyrics, and visible scene text in their requested original language; for overseas drama, dialogue remains the approved original English.
- Use stable `<Subject N>`, `<Picture N>`, `<Video N>`, `<Audio N>`, and `(Sx)` identities.
- Put only the language tag and exact spoken words inside `<d>...</d>`.
- Keep cut times strictly increasing and within the requested duration. Shot 1 has no cut timestamp.
- Put dialogue in the shot body, physical/ambient audio in `overall_soundscape`, and audience-only score in `non_diegetic_music`.
- Prefer concrete observable action to emotional adjectives and generic words such as 鈥渃inematic,鈥?鈥渆pic,鈥?or 鈥渄ynamic.鈥?
Run the structural validator after writing a prompt. Pass `--prompt-lang zh` for the default Chinese prompt prose; use `--prompt-lang en` for English prose:

```powershell
python scripts/validate_h3_prompt.py <prompt.txt> --mode ref2va --duration 15 --prompt-lang zh
```

Fix every error. Review warnings with judgment; warnings are not automatic failures.

## Deliver

Unless the user requests prompt-only output, return four clearly separated objects:

1. **Director brief** in the user's language: function, turn, POV, action chain, camera/light/performance/sound intention, and endpoint.
2. **Asset upload map** with exact Picture order and ComfyUI inputs.
3. **H3 prompt** in one clean text block containing no commentary.
4. **Continuity handoff** with planned endpoint and, after review, observed endpoint.

When saving files, keep the prompt and asset map beside the clip's assets. Do not overwrite an accepted version; create a new version.

## Continue from accepted footage

For sequences, follow `references/h3-sequence-continuity.md`. Planned state is provisional. Accepted footage's observed final state is canon. Never write the next prompt from a rejected take or from an unverified planned ending.

Apply the **real-frame handoff rule** to every connected module and episode boundary:

1. After each generated take, inspect the actual MP4 and save its first valid frame and last valid decoded frame as versioned PNG assets.
2. Promote frames only after the take is accepted. A rejected take's frames never enter the continuity chain.
3. The accepted `Mxx_END_FRAME` becomes the next module's `M(next)_START_FRAME` and must be uploaded as `<Picture 1>` / `ref_image_0`.
4. If `ref_video_0` is used, it must be the same accepted source video that produced that end frame. Do not mix a still from one take with a video from another.
5. State the physical endpoint explicitly in the new prompt; labels such as 鈥渃ontinuation鈥?do not give H3 memory of a previous clip.
6. Stage the final 0.3鈥?.5 seconds as a readable handoff: no unplanned cut, new character, prop teleport, or unresolved transformation in the final frame unless the next module is designed to consume it.

Use stable names such as `EP001_M03_END_FRAME_v01.png` and `EP001_M04_START_FRAME_v01.png`. Record the accepted source, frame timestamps or decoder position, and a hash when the pipeline supports it. For an intentional editorial hard cut, mark the handoff as `editorial_cut` and provide a deliberate new opening frame instead of pretending it is physical continuity.

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
- the accepted take has a saved real end frame, and that exact frame is assigned to the next module's `Picture 1` / `ref_image_0`;
- the final 0.3鈥?.5 seconds are stable enough to extract a useful handoff frame;
- the final prompt passes `validate_h3_prompt.py`.


