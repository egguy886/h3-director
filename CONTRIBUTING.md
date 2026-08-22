# Contributing

Keep the runtime Skill small and procedural. Put long, variant-specific guidance in `references/`, deterministic checks in `scripts/`, and user-facing explanation in the repository README or `docs/`.

Before opening a pull request:

1. run `quick_validate.py` against the Skill folder;
2. run `python scripts/validate_h3_prompt.py` against every changed example;
3. keep H3 field names, order, labels, and dialogue tags aligned with the official MiniMax H3 prompt-writing skill;
4. document any change to continuity or reference-authority behavior.


