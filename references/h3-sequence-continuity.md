# H3 Sequence Continuity

## Sequence law

Plan the episode globally but compile one current 4–15 second module at a time. Future modules remain provisional until the preceding take is accepted.

Accepted observed footage overrides the planned endpoint. Rejected footage never becomes canon.

## Required state

Track:

- `project_id`, `episode_id`, and `clip_id`;
- story beat completed and beats reserved for later;
- accepted source file and final frame;
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
```


