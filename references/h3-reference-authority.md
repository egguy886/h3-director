# H3 Reference Authority

## Assign before numbering

Create an authority map before writing `<Picture N>` labels. Each controlled dimension has one winner:

- face identity;
- body proportions;
- costume;
- environment/architecture;
- prop design;
- creature or alternate form;
- opening frame;
- intermediate keyframe;
- final frame;
- action/motion;
- camera/composition;
- light/color;
- voice/timbre;
- sound or timing.

One asset may control several compatible dimensions. No dimension may have two winners. If two assets conflict, follow user priority, then the project continuity lock, then the most specific asset.

## Separate identity from keyframes

A four-panel character card normally controls face, body, hair, and stable wardrobe identity. It does not automatically impose its gray background, panel layout, neutral pose, mosaic treatment, or horizontal composition on the generated video.

A storyboard/keyframe controls action, placement, viewpoint, or a specific target frame. It does not automatically replace the locked face or costume.

An environment card controls architecture, layout, weather, time, and palette. It does not supply extra people or inherit a character-card background.

State excluded transfer explicitly in the upload map, but keep final prompt prohibitions concise.

## H3 labels

Follow the official H3 reference guide:

- `<Subject N>` represents reusable visible content.
- `<Picture N>` is standalone only when the image itself acts as a concrete frame, keyframe, or storyboard/composition anchor.
- If an image only defines a subject, cite it inside that `<Subject N>` definition rather than creating an unnecessary standalone Picture definition.
- `<Video N>` controls source edit, continuation, temporal structure, camera, or motion relationships.
- `<Audio N>` controls copied or referenced audio roles and does not automatically exist because a video file has sound.

Do not create Seedance `@Image`, `@Video`, or `@Audio` tags.

## ComfyUI upload map

Use this mapping convention:

| H3 label | Comfy input |
|---|---|
| `<Picture 1>` | `ref_image_0` |
| `<Picture 2>` | `ref_image_1` |
| `<Picture 3>` | `ref_image_2` |

Continue by the same offset. A bypassed or empty node is not part of the current H3 Picture sequence. Never count its old filename.

Before the user executes, verify that the active wires, not the visual placement of nodes, connect the intended images to the Conditioning node.

## Model-facing boundary

The upload map may record private production metadata, but the H3 prompt must stay executable from the current inputs. Do not put episode/module IDs, accepted/rejected labels, local paths, missing-file status, or “cannot execute until…” notes into H3 fields. Replace them with the connected label (`<Picture N>`, `<Video N>`, or `<Audio N>`) plus concrete visible state and role. A word such as `continuation` does not give H3 memory; only the connected media and a restated physical endpoint do.

## Asset table

For every active asset, record:

- H3 label;
- absolute filename;
- primary role;
- required transfer;
- forbidden transfer;
- shots where it applies;
- Comfy input;
- active/bypassed status.

Drop duplicates and unused images. More references are not automatically better; conflicting authority increases identity and composition drift.


