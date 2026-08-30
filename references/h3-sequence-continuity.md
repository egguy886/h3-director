# H3 Sequence Continuity

## Sequence law

Plan the episode globally but compile one current 4–15 second module at a time. Future modules remain provisional until the preceding take is accepted.

Accepted observed footage overrides the planned endpoint. Rejected footage never becomes canon.

## Real-frame handoff contract

Every connected module has two frame artifacts:

- `Mxx_START_FRAME`: the actual first-frame authority for the current take;
- `Mxx_END_FRAME`: the actual final decoded frame of the accepted output.

For a physical continuation, the rule is deterministic:

```text
accepted M03 video
  -> extract actual M03_END_FRAME
  -> copy/reference it as M04_START_FRAME
  -> upload it as Picture 1 / ref_image_0
  -> generate M04
```

Do not use a storyboard endpoint, an unverified keyframe, or a rejected take as the next start frame. If a full reference video is connected through `ref_video_0`, it must be the same accepted video used to extract `Picture 1`. A prompt word such as `continuation` is metadata for the director and does not give the local H3 model memory of a prior clip; restate the physical endpoint in the prompt.

Extract the last valid decoded frame from the actual MP4, not a nominal `00:15.000` seek that may land on black, a duplicate frame, or a container padding frame. Check orientation, resolution, frame timing, visible identity, hand/object contact, and whether an unintended transition has already started. Reserve the final 0.3–0.5 seconds of a module for a stable handoff whenever the next module needs physical continuity. If the cut is intentionally editorial rather than physical, label it `editorial_cut` and create a new deliberate start frame.

Keep the source clip ID, acceptance verdict, filename, frame-extraction record, and pending/unknown status in the handoff and upload package only. In the H3 prompt, refer to the connected media as `<Picture 1>` or `<Video 1>` and describe the visible endpoint: body position, support, contact, prop state, screen direction, light, and audible state. Do not write internal labels such as `M07` or “验收尾帧” as though H3 could resolve them. If the cut is editorial rather than physical, declare an editorial cut and provide a deliberate new opening frame.

## Required state

Track:

- `project_id`, `episode_id`, and `clip_id`;
- story beat completed and beats reserved for later;
- accepted source file and final frame;
- accepted source file's actual first and last decoded frames, with versioned paths (and hashes when available);
- character identity, current form, position, facing, posture, injuries, wetness, blood, and wardrobe state;
- props and who owns or touches them;
- environment, time, weather, damage, fire, smoke, water, and practical-light state;
- screen direction, camera side of axis, shot scale, and endpoint composition;
- last audible dialogue, breath, impact, ambience, and music state;
- unresolved action or contact that the next clip must complete.

## Planned versus observed endpoint

Before generation, write `planned_endpoint`. After reviewing the returned take, write `observed_endpoint` using only visible or audible evidence. If the video cannot be inspected, keep the observed endpoint unknown and label user descriptions as user-reported.

Do not continue from an imagined hand position, facial expression, creature form, camera angle, or prop state that the accepted clip did not actually reach.

## Eight-module episode pattern

For a two-minute episode made of eight 15-second generations:

1. map the complete episode turn and final hook;
2. assign one local job and endpoint to M01–M08;
3. lock the project voice and stable visual/audio anchors;
4. compile only the current module;
5. review the take and update state;
6. compile the next module from the observed endpoint.

Do not force each module to contain its own unrelated music cue. Use environmental and bodily sound for continuity; add score only when a cross-module music plan exists.

## Continuity handoff template

```text
project_id:
episode_id:
clip_id:
verdict:
accepted_source:
completed_beat:
planned_endpoint:
observed_endpoint:
character_state:
prop_state:
environment_state:
screen_direction_and_axis:
camera_endpoint:
audio_endpoint:
next_clip_must_begin_with:
future_beats_not_yet_allowed:
start_frame_asset:
end_frame_asset:
next_clip_start_frame_asset:
handoff_type: physical_continuation | editorial_cut
frame_source_integrity: source video and frame extraction record
```


