import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sha256Exact(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function estimateDialogueSeconds(text, language) {
  const value = String(text ?? '');
  if (!value) return 0;
  if (/Chinese|Mandarin|Cantonese/i.test(String(language ?? ''))) {
    const spokenCharacters = (value.match(/[\p{Script=Han}\p{Letter}\p{Number}]/gu) ?? []).length;
    return Math.max(0.4, spokenCharacters / 4);
  }
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.4, words / 2.5);
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function sourceBeats(pkg) {
  return (pkg.source?.scenes ?? []).flatMap((scene) =>
    (scene.beats ?? []).map((beat) => ({ ...beat, sceneId: scene.id })),
  );
}

function promptText(segment) {
  return Object.values(segment.h3Prompt?.fields ?? {})
    .filter((value) => typeof value === 'string')
    .join('\n');
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export function validateProfile(pkg, errors = []) {
  const profile = pkg.profile ?? {};
  const segments = pkg.segments ?? [];
  if (profile.name === 'fixed-delivery') {
    const expectedCount = profile.segmentCount ?? 8;
    const expectedDuration = profile.segmentSeconds ?? 15;
    if (expectedCount * expectedDuration !== profile.episodeTargetSeconds) {
      addError(
        errors,
        'PROFILE_DURATION_MATH',
        'profile',
        'fixed-delivery segmentCount × segmentSeconds must equal episodeTargetSeconds exactly',
      );
    }
    if (segments.length !== expectedCount) {
      addError(
        errors,
        'FIXED_SEGMENT_COUNT',
        'segments',
        `fixed-delivery requires ${expectedCount} segments; found ${segments.length}`,
      );
    }
    segments.forEach((segment, index) => {
      if (segment.durationSeconds !== expectedDuration) {
        addError(
          errors,
          'FIXED_SEGMENT_DURATION',
          `segments[${index}].durationSeconds`,
          `fixed-delivery requires ${expectedDuration} seconds per segment`,
        );
      }
      if ((segment.sceneIds ?? []).length > 1) {
        if (!segment.editorialCut) {
          addError(
            errors,
            'EDITORIAL_CUT_REQUIRED',
            `segments[${index}].editorialCut`,
            'a fixed-delivery segment that crosses scenes requires an explicit editorial cut',
          );
        } else if (
          !(segment.editorialCut.atSeconds > 0 && segment.editorialCut.atSeconds < segment.durationSeconds)
          || segment.editorialCut.fromSceneId !== segment.sceneIds[0]
          || segment.editorialCut.toSceneId !== segment.sceneIds[1]
        ) {
          addError(
            errors,
            'EDITORIAL_CUT_INVALID',
            `segments[${index}].editorialCut`,
            'editorial cut must occur inside the clip and match the declared source-scene order',
          );
        }
      }
    });
  }

  if (profile.name === 'scene-safe') {
    segments.forEach((segment, index) => {
      if (segment.durationSeconds > profile.segmentMaxSeconds) {
        addError(
          errors,
          'SEGMENT_DURATION_EXCEEDS_MAX',
          `segments[${index}].durationSeconds`,
          `scene-safe segment exceeds the ${profile.segmentMaxSeconds}-second maximum`,
        );
      }
      if ((segment.sceneIds ?? []).length > 1) {
        addError(
          errors,
          'SCENE_SAFE_CROSS_SCENE',
          `segments[${index}].sceneIds`,
          'scene-safe segments may not cross source scene boundaries',
        );
      }
    });
  }
}

export function validateBeatCoverage(pkg, errors = []) {
  const beats = sourceBeats(pkg);
  const expected = beats.map((beat) => beat.id);
  const actual = (pkg.segments ?? []).flatMap((segment) => segment.beatIds ?? []);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    addError(
      errors,
      'BEAT_COVERAGE_MISMATCH',
      'segments[*].beatIds',
      'claimed beats must exactly equal the ordered source beat list',
    );
  }

  const counts = new Map();
  actual.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  for (const id of expected) {
    if (!counts.has(id)) {
      addError(errors, 'BEAT_MISSING', 'segments[*].beatIds', `source beat ${id} is unclaimed`);
    } else if (counts.get(id) > 1) {
      addError(errors, 'BEAT_DUPLICATE', 'segments[*].beatIds', `source beat ${id} is claimed more than once`);
    }
  }

  if (actual.some((id, index) => expected[index] !== id)) {
    addError(
      errors,
      'BEAT_OUT_OF_ORDER',
      'segments[*].beatIds',
      'beat claims do not preserve source order',
    );
  }

  const beatById = new Map(beats.map((beat) => [beat.id, beat]));
  (pkg.segments ?? []).forEach((segment, segmentIndex) => {
    for (const beatId of segment.beatIds ?? []) {
      const beat = beatById.get(beatId);
      if (beat && !(segment.sceneIds ?? []).includes(beat.sceneId)) {
        addError(
          errors,
          'BEAT_SCENE_MISMATCH',
          `segments[${segmentIndex}].sceneIds`,
          `beat ${beatId} belongs to ${beat.sceneId}, which is not declared by the segment`,
        );
      }
    }
  });
}

const VISUAL_EMBELLISHMENT_TYPES = new Set([
  'atmosphere',
  'weather_response',
  'non_causal_vfx',
  'material_response',
  'background_life',
  'lighting_accent',
  'performance_micro_behavior',
]);

export function validateVisualEmbellishments(pkg, errors = [], warnings = []) {
  (pkg.segments ?? []).forEach((segment, segmentIndex) => {
    (segment.visualEmbellishments ?? []).forEach((item, itemIndex) => {
      const path = `segments[${segmentIndex}].visualEmbellishments[${itemIndex}]`;
      if (!VISUAL_EMBELLISHMENT_TYPES.has(item.type)) {
        addError(errors, 'VISUAL_EMBELLISHMENT_TYPE_INVALID', `${path}.type`, 'visual embellishment type is missing or not allowed');
      }
      if (item.narrativeImpact !== 'none') {
        addError(
          errors,
          'VISUAL_EMBELLISHMENT_NARRATIVE_IMPACT',
          `${path}.narrativeImpact`,
          'visual embellishment may not create or alter narrative facts',
        );
      }
      if (item.type && item.narrativeImpact === 'none') {
        warnings.push({
          code: 'VISUAL_EMBELLISHMENT_SEMANTIC_REVIEW',
          path,
          message: 'confirm semantically that this embellishment does not alter causality, intent, chronology, or outcome',
        });
      }
    });
  });
}

function isEmptyContractValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function validateDirectorContract(segment, errors = []) {
  const contract = segment.directorContract ?? {};
  const required = [
    'assets',
    'space',
    'openingState',
    'camera',
    'actionPerformance',
    'dialogueSound',
    'finalState',
    'reviewStrategy',
  ];
  const missing = required.filter((field) => isEmptyContractValue(contract[field]));
  if (missing.length > 0) {
    addError(
      errors,
      'DIRECTOR_CONTRACT_INCOMPLETE',
      `${segment.id ?? 'segment'}.directorContract`,
      `eight-step director contract is missing: ${missing.join(', ')}`,
    );
  }
}

export function validateDialogue(pkg, errors = []) {
  const dialogueBeats = sourceBeats(pkg).filter((beat) => beat.type === 'dialogue');
  const ledger = pkg.dialogueLedger ?? [];
  const ledgerByBeat = new Map(ledger.map((entry) => [entry.beatId, entry]));

  for (const beat of dialogueBeats) {
    const entry = ledgerByBeat.get(beat.id);
    if (!entry) {
      addError(errors, 'DIALOGUE_LEDGER_MISSING', 'dialogueLedger', `missing ledger entry for ${beat.id}`);
      continue;
    }
    if (entry.sourceDialogue !== beat.text) {
      addError(
        errors,
        'DIALOGUE_SOURCE_MISMATCH',
        `dialogueLedger[${ledger.indexOf(entry)}].sourceDialogue`,
        `ledger source dialogue for ${beat.id} differs from the script`,
      );
    }
    if (
      entry.approvedDialogue !== entry.sourceDialogue
      && !(entry.approval?.status === 'approved' && entry.approval?.id)
    ) {
      addError(
        errors,
        'DIALOGUE_UNAPPROVED_VARIANT',
        `dialogueLedger[${ledger.indexOf(entry)}].approvedDialogue`,
        `dialogue variant for ${beat.id} requires an explicit approval record`,
      );
    }
    if (entry.checksum !== sha256Exact(entry.approvedDialogue)) {
      addError(
        errors,
        'DIALOGUE_CHECKSUM_MISMATCH',
        `dialogueLedger[${ledger.indexOf(entry)}].checksum`,
        `checksum for ${beat.id} does not match approvedDialogue exactly`,
      );
    }
  }

  (pkg.segments ?? []).forEach((segment, segmentIndex) => {
    const text = promptText(segment);
    const lines = segment.dialogue ?? [];
    const estimatedDialogueSeconds = lines.reduce(
      (total, line) => total + (line.estimatedSeconds ?? estimateDialogueSeconds(line.text, line.language)),
      0,
    );
    if (
      Number.isFinite(segment.durationSeconds)
      && estimatedDialogueSeconds > Math.max(0, segment.durationSeconds - (segment.dialogueActionReserveSeconds ?? 2))
    ) {
      addError(
        errors,
        'DIALOGUE_CAPACITY_EXCEEDED',
        `segments[${segmentIndex}].dialogue`,
        `estimated dialogue ${estimatedDialogueSeconds.toFixed(2)}s exceeds the clip capacity after action/reaction reserve`,
      );
    }
    for (const line of lines) {
      const entry = ledgerByBeat.get(line.beatId);
      if (!entry) {
        addError(
          errors,
          'DIALOGUE_LEDGER_REFERENCE_UNKNOWN',
          `segments[${segmentIndex}].dialogue`,
          `dialogue references unknown beat ${line.beatId}`,
        );
        continue;
      }
      if (line.text !== entry.approvedDialogue) {
        addError(
          errors,
          'DIALOGUE_SEGMENT_TEXT_MISMATCH',
          `segments[${segmentIndex}].dialogue`,
          `segment dialogue for ${line.beatId} differs from approvedDialogue`,
        );
      }
      const exactBlock = `<d>[${entry.language}] ${entry.approvedDialogue}</d>`;
      if (countOccurrences(text, exactBlock) !== 1) {
        addError(
          errors,
          'DIALOGUE_PROMPT_EXACT_BLOCK_MISSING',
          `segments[${segmentIndex}].h3Prompt.fields`,
          `prompt must contain exactly one exact dialogue block for ${line.beatId}`,
        );
      }
      const delivery = line.delivery ?? entry.delivery;
      if (delivery === 'on_screen' && line.mouthVisibility !== 'visible') {
        addError(
          errors,
          'DIALOGUE_MOUTH_NOT_VISIBLE',
          `segments[${segmentIndex}].dialogue`,
          `on-screen dialogue ${line.beatId} requires visible mouth timing`,
        );
      }
    }

    if (lines.length > 0 && /no intelligible dialogue/i.test(text)) {
      addError(
        errors,
        'DIALOGUE_SILENCED',
        `segments[${segmentIndex}].h3Prompt.fields`,
        'a dialogue-bearing segment may not be compiled as silent',
      );
    }
  });
}

const BASE_H3_FIELDS = [
  'integrated_multimodal_description',
  'overall_soundscape',
  'non_diegetic_music',
];

const REF_H3_FIELDS = [
  'subject_definitions',
  'summary',
  'retention_analysis',
  'detailed_description',
  'overall_soundscape',
  'non_diegetic_music',
];

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stripAllowedLanguage(prompt, h3Prompt) {
  let stripped = prompt.replace(/<d>\[[^\]]+\][\s\S]*?<\/d>/g, '');
  for (const literal of h3Prompt.visibleTextLiterals ?? []) {
    stripped = stripped.split(literal).join('');
  }
  return stripped;
}

export function validateH3Prompt(segment, errors = [], warnings = []) {
  const h3Prompt = segment.h3Prompt;
  if (!h3Prompt || typeof h3Prompt !== 'object') {
    addError(errors, 'H3_PROMPT_MISSING', `${segment.id ?? 'segment'}.h3Prompt`, 'H3 prompt payload is required');
    return;
  }

  const mode = h3Prompt.mode;
  const fields = h3Prompt.fields ?? {};
  const expectedFields = mode === 'Ref2VA'
    ? REF_H3_FIELDS
    : ['T2VA', 'I2VA', 'FL2VA', 'L2VA'].includes(mode)
      ? BASE_H3_FIELDS
      : null;

  if (!expectedFields) {
    addError(errors, 'H3_MODE_UNSUPPORTED', `${segment.id}.h3Prompt.mode`, `unsupported H3 mode: ${mode}`);
    return;
  }

  const fieldKeys = Object.keys(fields);
  if (!arraysEqual(fieldKeys, expectedFields)) {
    addError(
      errors,
      'H3_FIELD_ORDER',
      `${segment.id}.h3Prompt.fields`,
      `H3 ${mode} fields must appear exactly in this order: ${expectedFields.join(', ')}`,
    );
  }

  const alignment = h3Prompt.alignmentInstruction;
  if (mode === 'T2VA' && alignment) {
    addError(errors, 'H3_ALIGNMENT_FORBIDDEN', `${segment.id}.h3Prompt.alignmentInstruction`, 'T2VA must not use an image-alignment instruction');
  }
  if (
    mode === 'I2VA'
    && alignment !== 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.'
  ) {
    addError(errors, 'H3_ALIGNMENT_INVALID', `${segment.id}.h3Prompt.alignmentInstruction`, 'I2VA requires the official first-frame alignment sentence');
  }
  if (
    mode === 'FL2VA'
    && !/^How the reference pictures align with the target video — Picture 1 \(from Shot 1\) aligns with the 0\.00-second mark of the target video; Picture 2 \(from Shot \d+\) aligns with the \d+(?:\.\d{2})?-second mark of the target video\.$/.test(alignment ?? '')
  ) {
    addError(errors, 'H3_ALIGNMENT_INVALID', `${segment.id}.h3Prompt.alignmentInstruction`, 'FL2VA requires the official first-and-last-frame alignment sentence');
  }
  if (
    mode === 'L2VA'
    && !/^How the reference pictures align with the target video — <Picture 1> \(from \[Shot \d+\]\) aligns with the \d+(?:\.\d{2})?-second mark of the target video\.$/.test(alignment ?? '')
  ) {
    addError(errors, 'H3_ALIGNMENT_INVALID', `${segment.id}.h3Prompt.alignmentInstruction`, 'L2VA requires the official last-frame alignment sentence');
  }

  const allPromptText = [alignment, ...Object.values(fields)]
    .filter((value) => typeof value === 'string')
    .join('\n');

  if (/[@＠](?:Image|Video|Audio)\s*\d+/i.test(allPromptText)) {
    addError(
      errors,
      'H3_FOREIGN_REFERENCE_SYNTAX',
      `${segment.id}.h3Prompt.fields`,
      'foreign platform reference tags such as @Image1 are forbidden',
    );
  }

  if (
    /(?:previous|next)\s+(?:segment|clip)|上一段|下一段|[A-Za-z]:\\|\/(?:Users|home|tmp)\//i.test(allPromptText)
  ) {
    addError(
      errors,
      'H3_PRODUCTION_METADATA',
      `${segment.id}.h3Prompt.fields`,
      'production metadata, cross-segment shorthand, and local paths must stay outside H3 fields',
    );
  }

  if (/\p{Script=Han}/u.test(stripAllowedLanguage(allPromptText, h3Prompt))) {
    addError(
      errors,
      'H3_NON_DIALOGUE_NOT_ENGLISH',
      `${segment.id}.h3Prompt.fields`,
      'official H3 rewrite prose must be English outside approved dialogue and visible-text literals',
    );
  }

  const labels = new Set(allPromptText.match(/<(?:Picture|Subject|Video|Audio)\s+\d+>/g) ?? []);
  const assetMap = h3Prompt.assetMap ?? {};
  for (const label of labels) {
    if (!assetMap[label]) {
      addError(
        errors,
        'H3_ASSET_BINDING_MISSING',
        `${segment.id}.h3Prompt.assetMap`,
        `${label} appears in the prompt but has no asset-map binding`,
      );
    }
  }

  const camera = segment.directorContract?.camera ?? {};
  const requiredCameraFields = [
    'dramaticJob',
    'startState',
    'trigger',
    'move',
    'framingInvariant',
    'endState',
  ];
  const missingCamera = requiredCameraFields.filter((field) => !camera[field]);
  if (missingCamera.length > 0) {
    addError(
      errors,
      'CAMERA_PLAN_INCOMPLETE',
      `${segment.id}.directorContract.camera`,
      `camera plan is missing: ${missingCamera.join(', ')}`,
    );
  }

  if (/locked[- ]off[\s\S]{0,120}(?:pan|tilt|dolly|track|handheld)|(?:pan|tilt|dolly|track|handheld)[\s\S]{0,120}locked[- ]off/i.test(allPromptText)) {
    warnings.push({
      code: 'CAMERA_STATE_CONFLICT_POSSIBLE',
      path: `${segment.id}.h3Prompt.fields`,
      message: 'prompt may request locked-off and moving camera states in the same beat',
    });
  }
}

export function validateStateMachine(pkg, errors = []) {
  const segments = pkg.segments ?? [];
  segments.forEach((segment, index) => {
    if (segment.status === 'ACCEPTED') {
      const accepted = segment.acceptedTake;
      const take = (segment.takes ?? []).find((item) => item.id === accepted?.id);
      if (!accepted || take?.status !== 'ACCEPTED' || !accepted.tailFramePath || !accepted.observedState) {
        addError(
          errors,
          'ACCEPTED_TAKE_MISSING',
          `segments[${index}].acceptedTake`,
          'an ACCEPTED segment requires an accepted take, real tail frame, and observed final state',
        );
      }
    }

    if (index === 0 || !['RECOMPILE', 'GENERATION_READY', 'GENERATED', 'ACCEPTED'].includes(segment.status)) {
      return;
    }

    const previous = segments[index - 1];
    const incoming = segment.continuity?.incoming;
    if (previous.status !== 'ACCEPTED' || !previous.acceptedTake) {
      addError(
        errors,
        'HANDOFF_PREVIOUS_NOT_ACCEPTED',
        `segments[${index}].status`,
        `${segment.id} cannot advance before ${previous.id} has an accepted canonical take`,
      );
    }

    if (incoming) {
      const sourceTake = (previous.takes ?? []).find((take) => take.id === incoming.sourceTakeId);
      if (sourceTake?.status === 'REJECTED' || sourceTake?.status === 'SUPERSEDED') {
        addError(
          errors,
          'HANDOFF_REJECTED_TAKE',
          `segments[${index}].continuity.incoming`,
          `take ${incoming.sourceTakeId} is not eligible for continuity handoff`,
        );
      }
      if (
        previous.acceptedTake
        && (
          incoming.sourceSegmentId !== previous.id
          || incoming.sourceTakeId !== previous.acceptedTake.id
          || incoming.framePath !== previous.acceptedTake.tailFramePath
        )
      ) {
        addError(
          errors,
          'HANDOFF_SOURCE_MISMATCH',
          `segments[${index}].continuity.incoming`,
          'incoming continuity does not match the immediately previous accepted take and frame',
        );
      }
      if (
        ['GENERATION_READY', 'GENERATED', 'ACCEPTED'].includes(segment.status)
        && incoming.promptCompiledForTakeId !== incoming.sourceTakeId
      ) {
        addError(
          errors,
          'HANDOFF_PROMPT_NOT_RECOMPILED',
          `segments[${index}].continuity.incoming.promptCompiledForTakeId`,
          'the prompt must be recompiled and revalidated against the canonical incoming take',
        );
      }
    } else {
      addError(
        errors,
        'HANDOFF_INCOMING_MISSING',
        `segments[${index}].continuity.incoming`,
        'an advanced downstream segment requires a canonical incoming handoff',
      );
    }
  });
}

function handoffError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function applyAcceptedHandoff(pkg, input) {
  const result = structuredClone(pkg);
  const segmentIndex = (result.segments ?? []).findIndex((segment) => segment.id === input.segmentId);
  if (segmentIndex < 0) {
    throw handoffError('HANDOFF_SEGMENT_NOT_FOUND', `segment not found: ${input.segmentId}`);
  }
  const segment = result.segments[segmentIndex];
  const take = (segment.takes ?? []).find((item) => item.id === input.takeId);
  if (take?.status !== 'ACCEPTED') {
    throw handoffError('HANDOFF_TAKE_NOT_ACCEPTED', `take ${input.takeId} is not accepted`);
  }
  if (!input.framePath || !input.observedState || typeof input.observedState !== 'object') {
    throw handoffError('HANDOFF_OBSERVED_STATE_REQUIRED', 'real tail frame and observed final state are required');
  }

  const replacingTakeId = segment.acceptedTake?.id;
  if (replacingTakeId && replacingTakeId !== input.takeId) {
    const acceptedDownstream = result.segments
      .slice(segmentIndex + 1)
      .find((item) => item.status === 'ACCEPTED');
    if (acceptedDownstream) {
      throw handoffError(
        'HANDOFF_DOWNSTREAM_ACCEPTED',
        `cannot supersede ${replacingTakeId} while downstream segment ${acceptedDownstream.id} is accepted`,
      );
    }
  }

  for (const candidate of segment.takes ?? []) {
    if (candidate.id !== input.takeId && candidate.status === 'ACCEPTED') {
      candidate.status = 'SUPERSEDED';
    }
  }
  take.status = 'ACCEPTED';
  segment.status = 'ACCEPTED';
  segment.acceptedTake = {
    id: input.takeId,
    status: 'ACCEPTED',
    tailFramePath: input.framePath,
    observedState: structuredClone(input.observedState),
  };
  segment.continuity ??= {};
  segment.continuity.outgoing = {
    sourceSegmentId: segment.id,
    sourceTakeId: input.takeId,
    framePath: input.framePath,
    observedState: structuredClone(input.observedState),
  };

  const next = result.segments[segmentIndex + 1];
  if (next) {
    next.status = 'RECOMPILE';
    next.continuity ??= {};
    next.continuity.incoming = {
      sourceSegmentId: segment.id,
      sourceTakeId: input.takeId,
      framePath: input.framePath,
      observedState: structuredClone(input.observedState),
      promptCompiledForTakeId: null,
      requiresPromptRecompile: true,
    };
    next.h3Prompt ??= {};
    next.h3Prompt.assetMap ??= {};
    next.h3Prompt.assetMap['<Picture 1>'] = input.framePath;
  }

  for (const downstream of result.segments.slice(segmentIndex + 2)) {
    if (downstream.status !== 'ACCEPTED') {
      downstream.status = 'WAITING_FOR_HANDOFF';
      if (downstream.continuity) {
        delete downstream.continuity.incoming;
      }
      if (downstream.h3Prompt?.assetMap) {
        delete downstream.h3Prompt.assetMap['<Picture 1>'];
      }
    }
  }

  return result;
}

export function validatePackage(pkg, options = {}) {
  const errors = [];
  const warnings = [];
  validateProfile(pkg, errors);
  validateBeatCoverage(pkg, errors);
  validateDialogue(pkg, errors);
  validateVisualEmbellishments(pkg, errors, warnings);
  validateStateMachine(pkg, errors);
  (pkg.segments ?? []).forEach((segment) => {
    validateDirectorContract(segment, errors);
    validateH3Prompt(segment, errors, warnings);
  });
  if (options.checkAssets) {
    const baseDirectory = options.packagePath ? dirname(resolve(options.packagePath)) : process.cwd();
    (pkg.segments ?? []).forEach((segment, segmentIndex) => {
      for (const [label, binding] of Object.entries(segment.h3Prompt?.assetMap ?? {})) {
        const assetPath = typeof binding === 'string' ? binding : binding?.path;
        if (!assetPath || /^https?:\/\//i.test(assetPath)) continue;
        const resolvedAsset = isAbsolute(assetPath) ? assetPath : resolve(baseDirectory, assetPath);
        if (!existsSync(resolvedAsset)) {
          addError(
            errors,
            'ASSET_FILE_MISSING',
            `segments[${segmentIndex}].h3Prompt.assetMap.${label}`,
            `asset file does not exist: ${resolvedAsset}`,
          );
        }
      }
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const value = args[index + 1];
    if (value == null || value.startsWith('--')) {
      flags[name] = true;
    } else {
      flags[name] = value;
      index += 1;
    }
  }
  return flags;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return [
    'Usage:',
    '  node h3-drama-director.mjs validate <package.json>',
    '  node h3-drama-director.mjs handoff <package.json> --segment <id> --take <id> --frame <path> --state <state.json> --out <new-package.json>',
    '  node h3-drama-director.mjs checksum <text-file>',
  ].join('\n');
}

function runCli(argv) {
  const [command, inputPath, ...rest] = argv;
  if (!command || !inputPath) {
    throw handoffError('CLI_USAGE', usage());
  }

  if (command === 'validate') {
    const flags = parseFlags(rest);
    const result = validatePackage(readJson(inputPath), {
      checkAssets: flags['check-assets'] === true,
      packagePath: inputPath,
    });
    printJson(result);
    return result.ok ? 0 : 1;
  }

  if (command === 'checksum') {
    const text = readFileSync(inputPath, 'utf8');
    printJson({ path: inputPath, checksum: sha256Exact(text) });
    return 0;
  }

  if (command === 'handoff') {
    const flags = parseFlags(rest);
    for (const required of ['segment', 'take', 'frame', 'state', 'out']) {
      if (!flags[required] || flags[required] === true) {
        throw handoffError('CLI_USAGE', `handoff requires --${required}\n${usage()}`);
      }
    }
    if (resolve(inputPath) === resolve(flags.out)) {
      throw handoffError('HANDOFF_OUTPUT_OVERWRITE_FORBIDDEN', '--out must differ from the input package path');
    }
    const result = applyAcceptedHandoff(readJson(inputPath), {
      segmentId: flags.segment,
      takeId: flags.take,
      framePath: flags.frame,
      observedState: readJson(flags.state),
    });
    writeFileSync(flags.out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    printJson({ ok: true, output: flags.out });
    return 0;
  }

  throw handoffError('CLI_USAGE', `unknown command: ${command}\n${usage()}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    printJson(
      { ok: false, errors: [{ code: error.code ?? 'CLI_ERROR', message: error.message }] },
      process.stderr,
    );
    process.exitCode = 1;
  }
}
