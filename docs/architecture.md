# Architecture

H3 Director separates three layers:

1. **Director layer** — the audience intention, beat chain, blocking, camera, light, performance, sound, and endpoint.
2. **Reference layer** — the primary authority of each picture/video/audio input and the traits that must not leak.
3. **Compiler layer** — the official H3 prompt fields, stable labels, timing rules, and the structural validator.

This separation lets a prompt be repaired at the correct layer. If the action is unclear, rewrite the shot contract; if the wrong face transfers, repair reference authority; if the text violates H3 structure, fix the compiler output. Do not add random descriptive prose to compensate for a layer error.

4. **Episode package layer** — the durable folder that joins validated prompts, categorized visual/audio assets, Picture-to-ComfyUI maps, continuity records, and reports.

The package layer is downstream of directing and compilation. It does not change prompt semantics. It makes each episode portable, reviewable from `file://`, and safe to hand to a ComfyUI operator. When available, the separate `novel-art` renderer supplies the detailed scene/prop report; H3 Director's bundled package builder supplies the merged index and validation surface.


