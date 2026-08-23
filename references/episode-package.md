# Episode package contract

Use this contract when the user wants a durable production folder rather than a prompt-only answer. It keeps one episode's H3 prompts, visual/audio references, ComfyUI mapping, continuity state, and visual-asset report together.

## Canonical layout

```text
episodes/
└── EP001/
    ├── README.md
    ├── prompts/
    │   ├── EP001_M01_ref2va.txt
    │   └── ...
    ├── assets/
    │   ├── characters/
    │   ├── scenes/
    │   ├── keyframes/
    │   ├── props/
    │   └── audio/
    ├── upload-map/
    │   └── EP001_UPLOAD_MAP.md
    ├── continuity/
    │   └── EP001_CONTINUITY.md
    └── report/
        ├── episode-report.html
        ├── episode-manifest.json
        ├── validation.json
        ├── EP001-art.json              # optional novel-art source
        ├── art-report.html             # optional novel-art renderer output
        └── images/                      # optional novel-art image sheets
```

The prompt and asset filenames are episode-local. Do not mix accepted assets or rejected-take references from another episode. Keep the H3 Picture numbering in the upload map: Picture 1 maps to `ref_image_0`, Picture 2 to `ref_image_1`, and so on.

## Report contract

`report/episode-report.html` is the merged, browser-openable index. It must show:

- episode ID, title, canonical source, and package counts;
- every prompt with download/copy action and validator status;
- every asset grouped by category with image/video/audio preview where possible;
- links to the upload map and continuity file;
- a downloadable `episode-manifest.json`;
- an optional link to the full `novel-art` `art-report.html`.

The report is a navigation and QA surface, not a replacement for the clean H3 prompt. Never paste Director's Read labels into the prompt preview as if they were H3 fields.

## Build command

Use the bundled deterministic builder after the prompt and asset decisions are accepted:

```powershell
python scripts/build_episode_package.py `
  --episode-id EP001 `
  --title "Last Antidote" `
  --source "D:\project\episodes\ep001.md" `
  --prompts-dir "D:\project\prompts" `
  --assets-root characters="D:\project\assets\characters" `
  --assets-root scenes="D:\project\assets\scenes" `
  --assets-root keyframes="D:\project\assets\keyframes" `
  --assets-root props="D:\project\assets\props" `
  --upload-map "D:\project\upload-map\EP001_UPLOAD_MAP.md" `
  --continuity "D:\project\continuity\EP001_CONTINUITY.md" `
  --art-json "D:\project\novel-art\EP001-art.json" `
  --novel-art-report "D:\project\novel-art\art-report.html" `
  --novel-art-images "D:\project\novel-art\images" `
  --out "D:\project\episodes\EP001"
```

When the `novel-art` skill is available, render its Markdown/HTML report first, then pass the report and its `images/` directory to the builder. If it is unavailable, the merged H3 Director report still works and lists the supplied scene/prop/keyframe assets.

## Quality gates

1. Run `validate_h3_prompt.py` for every prompt; fix errors before packaging.
2. Confirm every upload-map path exists and every Picture has one authority.
3. Check that the report opens from `file://` without a server and that local image links resolve.
4. Keep the package reproducible: source, prompts, assets, maps, and reports must be inside or explicitly linked from the episode folder.
