import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAcceptedHandoff,
  estimateDialogueSeconds,
  sha256Exact,
  validateBeatCoverage,
  validateDialogue,
  validateDirectorContract,
  validateH3Prompt,
  validateProfile,
  validateStateMachine,
  validateVisualEmbellishments,
} from './h3-drama-director.mjs';

const moduleUrl = new URL('./h3-drama-director.mjs', import.meta.url);
const modulePath = fileURLToPath(moduleUrl);

test('validator module exposes the public API', async () => {
  assert.equal(existsSync(modulePath), true, 'validator module must exist');
  const api = await import(moduleUrl.href);
  for (const name of [
    'sha256Exact',
    'validatePackage',
    'validateProfile',
    'validateBeatCoverage',
    'validateDialogue',
    'validateH3Prompt',
    'validateStateMachine',
    'applyAcceptedHandoff',
    'estimateDialogueSeconds',
    'validateVisualEmbellishments',
    'validateDirectorContract',
  ]) {
    assert.equal(typeof api[name], 'function', `${name} must be exported`);
  }
});

function errorCodes(errors) {
  return new Set(errors.map((item) => item.code));
}

function fixedProfilePackage(overrides = {}) {
  const segments = Array.from({ length: 8 }, (_, index) => ({
    id: `M${String(index + 1).padStart(2, '0')}`,
    durationSeconds: 15,
    sceneIds: ['SC01'],
    beatIds: [],
  }));
  return {
    profile: {
      name: 'fixed-delivery',
      episodeTargetSeconds: 120,
      segmentCount: 8,
      segmentSeconds: 15,
      segmentMaxSeconds: 15,
    },
    segments,
    ...overrides,
  };
}

function dialoguePackage() {
  const text = 'Stay behind me.';
  return {
    source: {
      scenes: [{
        id: 'SC01',
        beats: [{
          id: 'B01',
          type: 'dialogue',
          speaker: 'Lucas',
          text,
          language: 'English',
          delivery: 'on_screen',
        }],
      }],
    },
    dialogueLedger: [{
      beatId: 'B01',
      speaker: 'Lucas',
      sourceDialogue: text,
      approvedDialogue: text,
      language: 'English',
      delivery: 'on_screen',
      checksum: sha256Exact(text),
    }],
    segments: [{
      id: 'M01',
      durationSeconds: 15,
      sceneIds: ['SC01'],
      beatIds: ['B01'],
      dialogue: [{
        beatId: 'B01',
        speaker: 'Lucas',
        text,
        language: 'English',
        delivery: 'on_screen',
        mouthVisibility: 'visible',
      }],
      h3Prompt: {
        mode: 'I2VA',
        fields: {
          integrated_multimodal_description: `[Shot 1] Lucas (S1) says: <d>[English] ${text}</d>`,
          overall_soundscape: 'Rain and close breathing.',
          non_diegetic_music: 'None.',
        },
      },
    }],
  };
}

test('fixed-delivery requires exactly eight 15-second segments', () => {
  const pkg = fixedProfilePackage();
  pkg.segments.pop();
  pkg.segments[0].durationSeconds = 14;
  const errors = [];
  validateProfile(pkg, errors);
  const codes = errorCodes(errors);
  assert.equal(codes.has('FIXED_SEGMENT_COUNT'), true);
  assert.equal(codes.has('FIXED_SEGMENT_DURATION'), true);
});

test('every source beat is claimed exactly once in source order', () => {
  const pkg = {
    source: {
      scenes: [
        { id: 'SC01', beats: [{ id: 'B01' }, { id: 'B02' }] },
        { id: 'SC02', beats: [{ id: 'B03' }] },
      ],
    },
    segments: [
      { id: 'M01', sceneIds: ['SC01'], beatIds: ['B01', 'B03'] },
      { id: 'M02', sceneIds: ['SC01'], beatIds: ['B01'] },
    ],
  };
  const errors = [];
  validateBeatCoverage(pkg, errors);
  const codes = errorCodes(errors);
  assert.equal(codes.has('BEAT_COVERAGE_MISMATCH'), true);
  assert.equal(codes.has('BEAT_DUPLICATE'), true);
  assert.equal(codes.has('BEAT_MISSING'), true);
  assert.equal(codes.has('BEAT_OUT_OF_ORDER'), true);
});

test('cross-scene fixed segment requires an editorial cut', () => {
  const pkg = fixedProfilePackage();
  pkg.segments[0].sceneIds = ['SC01', 'SC02'];
  const errors = [];
  validateProfile(pkg, errors);
  assert.equal(errorCodes(errors).has('EDITORIAL_CUT_REQUIRED'), true);
});

test('scene-safe rejects a cross-scene segment', () => {
  const pkg = {
    profile: {
      name: 'scene-safe',
      episodeTargetSeconds: 30,
      segmentTargetSeconds: 13.5,
      segmentMaxSeconds: 15,
    },
    segments: [{
      id: 'M01',
      durationSeconds: 15,
      sceneIds: ['SC01', 'SC02'],
      beatIds: [],
      editorialCut: { atSeconds: 7, fromSceneId: 'SC01', toSceneId: 'SC02' },
    }],
  };
  const errors = [];
  validateProfile(pkg, errors);
  assert.equal(errorCodes(errors).has('SCENE_SAFE_CROSS_SCENE'), true);
});

test('dialogue text and sha256 must match the approved source', () => {
  const pkg = dialoguePackage();
  pkg.dialogueLedger[0].checksum = sha256Exact('different');
  pkg.segments[0].dialogue[0].text = 'Stay close to me.';
  const errors = [];
  validateDialogue(pkg, errors);
  const codes = errorCodes(errors);
  assert.equal(codes.has('DIALOGUE_CHECKSUM_MISMATCH'), true);
  assert.equal(codes.has('DIALOGUE_SEGMENT_TEXT_MISMATCH'), true);
});

test('dialogue-bearing prompts require exact d blocks and visible mouth policy', () => {
  const pkg = dialoguePackage();
  pkg.segments[0].dialogue[0].mouthVisibility = 'hidden';
  pkg.segments[0].h3Prompt.fields.integrated_multimodal_description = '[Shot 1] Lucas speaks.';
  const errors = [];
  validateDialogue(pkg, errors);
  const codes = errorCodes(errors);
  assert.equal(codes.has('DIALOGUE_PROMPT_EXACT_BLOCK_MISSING'), true);
  assert.equal(codes.has('DIALOGUE_MOUTH_NOT_VISIBLE'), true);
});

test('silent prompts may not replace source dialogue', () => {
  const pkg = dialoguePackage();
  pkg.segments[0].h3Prompt.fields.integrated_multimodal_description = 'No intelligible dialogue.';
  const errors = [];
  validateDialogue(pkg, errors);
  assert.equal(errorCodes(errors).has('DIALOGUE_SILENCED'), true);
});

function validH3Segment(mode = 'I2VA') {
  const baseFields = {
    integrated_multimodal_description: '[Shot 1] Live-action cinematic medium shot. <Picture 1> anchors the opening frame. Lucas (S1) says: <d>[English] Stay behind me.</d>',
    overall_soundscape: 'Steady rain, cloth movement, and close breathing.',
    non_diegetic_music: 'None.',
  };
  const refFields = {
    subject_definitions: '<Subject 1> is Lucas, preserving his face, build, and costume from <Picture 1>.',
    summary: '[reference generation + keyframe completion] The target video follows <Subject 1> from the opening frame.',
    retention_analysis: '<Subject 1>: fully_preserved - identity and costume remain stable.\n<Picture 1> ([Shot 1] first frame): fully_preserved - opening composition is retained.',
    detailed_description: '[Shot 1] Live-action cinematic medium shot. <Picture 1> anchors the opening frame as <Subject 1> (S1) says: <d>[English] Stay behind me.</d>',
    overall_soundscape: 'Steady rain, cloth movement, and close breathing.',
    non_diegetic_music: 'None.',
  };
  return {
    id: 'M01',
    h3Prompt: {
      mode,
      alignmentInstruction: mode === 'I2VA'
        ? 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.'
        : undefined,
      fields: mode === 'Ref2VA' ? refFields : baseFields,
      assetMap: {
        '<Picture 1>': 'opening-frame.png',
        '<Subject 1>': 'lucas-approved.png',
      },
    },
    directorContract: {
      assets: { locked: ['Lucas approved identity', 'opening frame'] },
      space: { axis: 'Lucas faces frame right; threat remains frame right.' },
      openingState: 'Lucas stands frame left with a wrench in his right hand.',
      camera: {
        dramaticJob: 'Increase protective urgency.',
        startState: 'Eye-level medium shot, camera two metres in front of Lucas.',
        trigger: 'Lucas hears metal strike behind him.',
        move: 'Slow dolly in by half a metre.',
        framingInvariant: 'Keep Lucas centred with his mouth and both eyes visible.',
        endState: 'Medium close-up held for 0.4 seconds.',
      },
      actionPerformance: 'Lucas hears the impact, shields Elara, then speaks without breaking eye-line.',
      dialogueSound: 'Lucas speaks on screen; rain and breath remain continuous.',
      finalState: 'Lucas holds frame left, still facing right, wrench in his right hand.',
      reviewStrategy: 'KEEP if dialogue, identity, prop hand, and endpoint all match; otherwise change one primary variable.',
    },
  };
}

test('base H3 modes use the official three fields in order', () => {
  const segment = validH3Segment();
  segment.h3Prompt.fields = {
    overall_soundscape: 'Rain.',
    integrated_multimodal_description: '[Shot 1] <Picture 1> anchors the frame.',
    non_diegetic_music: 'None.',
  };
  const errors = [];
  validateH3Prompt(segment, errors, []);
  assert.equal(errorCodes(errors).has('H3_FIELD_ORDER'), true);
});

test('Ref2VA uses the official six fields in order', () => {
  const segment = validH3Segment('Ref2VA');
  const values = segment.h3Prompt.fields;
  segment.h3Prompt.fields = {
    summary: values.summary,
    subject_definitions: values.subject_definitions,
    retention_analysis: values.retention_analysis,
    detailed_description: values.detailed_description,
    overall_soundscape: values.overall_soundscape,
    non_diegetic_music: values.non_diegetic_music,
  };
  const errors = [];
  validateH3Prompt(segment, errors, []);
  assert.equal(errorCodes(errors).has('H3_FIELD_ORDER'), true);
});

test('non-dialogue H3 prose rejects CJK outside dialogue', () => {
  const segment = validH3Segment();
  segment.h3Prompt.fields.integrated_multimodal_description += ' 雨夜压迫感。 <d>[Chinese] 快跑！</d>';
  const errors = [];
  validateH3Prompt(segment, errors, []);
  assert.equal(errorCodes(errors).has('H3_NON_DIALOGUE_NOT_ENGLISH'), true);
});

test('H3 prompt rejects production metadata and Seedance reference tags', () => {
  const segment = validH3Segment();
  segment.h3Prompt.fields.integrated_multimodal_description += ' Continue from the previous segment at C:\\temp\\M01 using @Image1.';
  const errors = [];
  validateH3Prompt(segment, errors, []);
  const codes = errorCodes(errors);
  assert.equal(codes.has('H3_PRODUCTION_METADATA'), true);
  assert.equal(codes.has('H3_FOREIGN_REFERENCE_SYNTAX'), true);
});

test('every Picture and Subject label has an asset-map binding', () => {
  const segment = validH3Segment();
  segment.h3Prompt.fields.integrated_multimodal_description += ' <Picture 2> shows <Subject 2> entering.';
  const errors = [];
  validateH3Prompt(segment, errors, []);
  const codes = errorCodes(errors);
  assert.equal(codes.has('H3_ASSET_BINDING_MISSING'), true);
});

test('camera plan requires start trigger move invariant and end state', () => {
  const segment = validH3Segment();
  delete segment.directorContract.camera.trigger;
  delete segment.directorContract.camera.endState;
  const errors = [];
  validateH3Prompt(segment, errors, []);
  assert.equal(errorCodes(errors).has('CAMERA_PLAN_INCOMPLETE'), true);
});

test('a clean official I2VA prompt and complete camera plan pass H3 validation', () => {
  const errors = [];
  validateH3Prompt(validH3Segment(), errors, []);
  assert.deepEqual(errors, []);
});

function handoffPackage() {
  return {
    segments: [
      {
        id: 'M01',
        status: 'GENERATED',
        takes: [{ id: 'T01', status: 'ACCEPTED' }],
        h3Prompt: { assetMap: { '<Picture 1>': 'episode-opening.png' } },
      },
      {
        id: 'M02',
        status: 'WAITING_FOR_HANDOFF',
        takes: [],
        h3Prompt: { assetMap: {} },
      },
    ],
  };
}

const acceptedInput = {
  segmentId: 'M01',
  takeId: 'T01',
  framePath: 'accepted/M01_T01_tail.png',
  observedState: {
    characters: 'Lucas stands frame left, facing right.',
    props: 'Wrench remains in Lucas right hand.',
    light: 'Cold rain light from frame right.',
    screenDirection: 'Lucas faces and travels right.',
  },
};

test('segment two cannot be ready before segment one is accepted', () => {
  const pkg = handoffPackage();
  pkg.segments[0].takes[0].status = 'GENERATED';
  pkg.segments[1].status = 'GENERATION_READY';
  const errors = [];
  validateStateMachine(pkg, errors);
  assert.equal(errorCodes(errors).has('HANDOFF_PREVIOUS_NOT_ACCEPTED'), true);
});

test('only an accepted take can emit a canonical handoff', () => {
  const pkg = handoffPackage();
  pkg.segments[0].takes[0].status = 'REJECTED';
  assert.throws(
    () => applyAcceptedHandoff(pkg, acceptedInput),
    (error) => error.code === 'HANDOFF_TAKE_NOT_ACCEPTED',
  );
});

test('rejected take frames never enter the handoff chain', () => {
  const pkg = handoffPackage();
  pkg.segments[0].status = 'GENERATED';
  pkg.segments[0].takes[0].status = 'REJECTED';
  pkg.segments[1].status = 'GENERATION_READY';
  pkg.segments[1].continuity = {
    incoming: {
      sourceSegmentId: 'M01',
      sourceTakeId: 'T01',
      framePath: 'rejected/M01_T01_tail.png',
    },
  };
  const errors = [];
  validateStateMachine(pkg, errors);
  assert.equal(errorCodes(errors).has('HANDOFF_REJECTED_TAKE'), true);
});

test('apply-handoff returns a new package and does not mutate input', () => {
  const pkg = handoffPackage();
  const before = structuredClone(pkg);
  const result = applyAcceptedHandoff(pkg, acceptedInput);
  assert.deepEqual(pkg, before);
  assert.notEqual(result, pkg);
});

test('next segment binds the exact accepted frame and observed state', () => {
  const result = applyAcceptedHandoff(handoffPackage(), acceptedInput);
  assert.equal(result.segments[0].status, 'ACCEPTED');
  assert.equal(result.segments[0].acceptedTake.tailFramePath, acceptedInput.framePath);
  assert.deepEqual(result.segments[0].continuity.outgoing.observedState, acceptedInput.observedState);
  assert.equal(result.segments[1].status, 'RECOMPILE');
  assert.equal(result.segments[1].continuity.incoming.sourceTakeId, 'T01');
  assert.equal(result.segments[1].h3Prompt.assetMap['<Picture 1>'], acceptedInput.framePath);
});

test('superseding an accepted take invalidates stale downstream overlays', () => {
  const first = applyAcceptedHandoff(handoffPackage(), acceptedInput);
  first.segments.push({
    id: 'M03',
    status: 'RECOMPILE',
    continuity: {
      incoming: {
        sourceSegmentId: 'M02',
        sourceTakeId: 'STALE_TAKE',
        framePath: 'stale/M02_tail.png',
      },
    },
    h3Prompt: { assetMap: { '<Picture 1>': 'stale/M02_tail.png' } },
  });
  first.segments[0].takes.push({ id: 'T02', status: 'ACCEPTED' });
  const second = applyAcceptedHandoff(first, {
    ...acceptedInput,
    takeId: 'T02',
    framePath: 'accepted/M01_T02_tail.png',
  });
  assert.equal(second.segments[0].takes[0].status, 'SUPERSEDED');
  assert.equal(second.segments[1].continuity.incoming.sourceTakeId, 'T02');
  assert.equal(second.segments[1].h3Prompt.assetMap['<Picture 1>'], 'accepted/M01_T02_tail.png');
  assert.equal(second.segments[2].status, 'WAITING_FOR_HANDOFF');
  assert.equal(second.segments[2].continuity.incoming, undefined);
  assert.equal(second.segments[2].h3Prompt.assetMap['<Picture 1>'], undefined);
});

test('dialogue capacity reserves time for breathing action and reactions', () => {
  const pkg = dialoguePackage();
  const longLine = Array.from({ length: 30 }, () => 'danger').join(' ');
  pkg.source.scenes[0].beats[0].text = longLine;
  pkg.dialogueLedger[0].sourceDialogue = longLine;
  pkg.dialogueLedger[0].approvedDialogue = longLine;
  pkg.dialogueLedger[0].checksum = sha256Exact(longLine);
  pkg.segments[0].dialogue[0].text = longLine;
  pkg.segments[0].durationSeconds = 5;
  pkg.segments[0].h3Prompt.fields.integrated_multimodal_description = `[Shot 1] Lucas (S1) says: <d>[English] ${longLine}</d>`;
  const errors = [];
  validateDialogue(pkg, errors);
  assert.equal(errorCodes(errors).has('DIALOGUE_CAPACITY_EXCEEDED'), true);
  assert.equal(estimateDialogueSeconds(longLine, 'English') > 10, true);
});

test('visual embellishment must be typed and have no narrative impact', () => {
  const pkg = {
    segments: [{
      id: 'M01',
      visualEmbellishments: [{
        type: 'non_causal_vfx',
        description: 'Blue energy dust trails from the approved dragon-heart core.',
        narrativeImpact: 'changes_outcome',
      }],
    }],
  };
  const errors = [];
  validateVisualEmbellishments(pkg, errors, []);
  assert.equal(errorCodes(errors).has('VISUAL_EMBELLISHMENT_NARRATIVE_IMPACT'), true);
});

test('eight-step director contract is required before H3 production', () => {
  const segment = validH3Segment();
  delete segment.directorContract.finalState;
  const errors = [];
  validateDirectorContract(segment, errors);
  assert.equal(errorCodes(errors).has('DIRECTOR_CONTRACT_INCOMPLETE'), true);
});

test('profile duration math and segment maximum are enforced', () => {
  const fixed = fixedProfilePackage();
  fixed.profile.episodeTargetSeconds = 119;
  const fixedErrors = [];
  validateProfile(fixed, fixedErrors);
  assert.equal(errorCodes(fixedErrors).has('PROFILE_DURATION_MATH'), true);

  const sceneSafe = {
    profile: { name: 'scene-safe', episodeTargetSeconds: 16, segmentTargetSeconds: 13.5, segmentMaxSeconds: 15 },
    segments: [{ id: 'M01', durationSeconds: 16, sceneIds: ['SC01'], beatIds: [] }],
  };
  const safeErrors = [];
  validateProfile(sceneSafe, safeErrors);
  assert.equal(errorCodes(safeErrors).has('SEGMENT_DURATION_EXCEEDS_MAX'), true);
});

test('fixed cross-scene segment requires a valid internal editorial cut', () => {
  const pkg = fixedProfilePackage();
  pkg.segments[0].sceneIds = ['SC01', 'SC02'];
  pkg.segments[0].editorialCut = { atSeconds: 15, fromSceneId: 'SC02', toSceneId: 'SC01' };
  const errors = [];
  validateProfile(pkg, errors);
  assert.equal(errorCodes(errors).has('EDITORIAL_CUT_INVALID'), true);
});

test('a beat may only be claimed by a segment that contains its source scene', () => {
  const pkg = {
    source: { scenes: [{ id: 'SC01', beats: [{ id: 'B01' }] }] },
    segments: [{ id: 'M01', sceneIds: ['SC02'], beatIds: ['B01'] }],
  };
  const errors = [];
  validateBeatCoverage(pkg, errors);
  assert.equal(errorCodes(errors).has('BEAT_SCENE_MISMATCH'), true);
});

test('dialogue variants require an explicit approval record', () => {
  const pkg = dialoguePackage();
  pkg.dialogueLedger[0].approvedDialogue = 'Stay close to me.';
  pkg.dialogueLedger[0].checksum = sha256Exact('Stay close to me.');
  pkg.segments[0].dialogue[0].text = 'Stay close to me.';
  pkg.segments[0].h3Prompt.fields.integrated_multimodal_description = '[Shot 1] Lucas (S1) says: <d>[English] Stay close to me.</d>';
  const errors = [];
  validateDialogue(pkg, errors);
  assert.equal(errorCodes(errors).has('DIALOGUE_UNAPPROVED_VARIANT'), true);
});

function validCliPackage() {
  const pkg = dialoguePackage();
  const h3 = validH3Segment();
  pkg.profile = {
    name: 'scene-safe',
    episodeTargetSeconds: 15,
    segmentTargetSeconds: 13.5,
    segmentMaxSeconds: 15,
  };
  pkg.segments[0].status = 'PLANNED';
  pkg.segments[0].directorContract = h3.directorContract;
  pkg.segments[0].h3Prompt = h3.h3Prompt;
  pkg.segments[0].visualEmbellishments = [];
  return pkg;
}

test('CLI validates packages, checksums exact bytes, and writes handoff only to --out', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'h3-drama-director-'));
  try {
    const validPath = join(tempRoot, 'valid.json');
    writeFileSync(validPath, JSON.stringify(validCliPackage(), null, 2), 'utf8');
    const validateRun = spawnSync(process.execPath, [modulePath, 'validate', validPath], { encoding: 'utf8' });
    assert.equal(validateRun.status, 0, validateRun.stderr || validateRun.stdout);
    assert.equal(JSON.parse(validateRun.stdout).ok, true);
    const assetRun = spawnSync(process.execPath, [modulePath, 'validate', validPath, '--check-assets'], { encoding: 'utf8' });
    assert.equal(assetRun.status, 1, assetRun.stderr || assetRun.stdout);
    assert.equal(
      errorCodes(JSON.parse(assetRun.stdout).errors).has('ASSET_FILE_MISSING'),
      true,
    );

    const textPath = join(tempRoot, 'dialogue.txt');
    writeFileSync(textPath, 'Exact dialogue.\n', 'utf8');
    const checksumRun = spawnSync(process.execPath, [modulePath, 'checksum', textPath], { encoding: 'utf8' });
    assert.equal(checksumRun.status, 0, checksumRun.stderr || checksumRun.stdout);
    assert.equal(JSON.parse(checksumRun.stdout).checksum, sha256Exact('Exact dialogue.\n'));

    const handoffPath = join(tempRoot, 'handoff.json');
    const statePath = join(tempRoot, 'state.json');
    const outputPath = join(tempRoot, 'output.json');
    const handoffSource = handoffPackage();
    writeFileSync(handoffPath, JSON.stringify(handoffSource, null, 2), 'utf8');
    writeFileSync(statePath, JSON.stringify(acceptedInput.observedState, null, 2), 'utf8');
    const handoffRun = spawnSync(process.execPath, [
      modulePath,
      'handoff',
      handoffPath,
      '--segment', 'M01',
      '--take', 'T01',
      '--frame', acceptedInput.framePath,
      '--state', statePath,
      '--out', outputPath,
    ], { encoding: 'utf8' });
    assert.equal(handoffRun.status, 0, handoffRun.stderr || handoffRun.stdout);
    assert.deepEqual(JSON.parse(readFileSync(handoffPath, 'utf8')), handoffSource);
    assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).segments[1].status, 'RECOMPILE');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
