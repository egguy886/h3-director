# Contributing to H3 短剧总导演

Keep the runtime Skill small and procedural. Put long, variant-specific guidance in `references/`, deterministic checks in `scripts/`, and user-facing explanation in `README.md`.

Before opening a pull request:

1. run `quick_validate.py` against the Skill folder;
2. run `node scripts/selftest.mjs`;
3. run `node scripts/h3-drama-director.mjs validate <episode-package.json>` for changed production packages;
4. keep H3 field names, order, labels, and dialogue tags aligned with the official MiniMax H3 prompt-writing skill;
5. document any change to continuity, dialogue-canon, or reference-authority behavior.


