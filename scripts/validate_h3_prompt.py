#!/usr/bin/env python3
"""Validate the deterministic structure of a MiniMax H3 prompt.

This checks official field contracts, timing, labels, and dialogue markup. It does
not score directing quality or predict model compliance.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path


BASE_FIELDS = [
    "integrated_multimodal_description",
    "overall_soundscape",
    "non_diegetic_music",
]
REF_FIELDS = [
    "subject_definitions",
    "summary",
    "retention_analysis",
    "detailed_description",
    "overall_soundscape",
    "non_diegetic_music",
]
FIELD_RE = re.compile(r"(?m)^([a-z_]+):\s*")
LABEL_RE = re.compile(r"<(Subject|Picture|Video|Audio)\s+(\d+)>")
SHOT_RE = re.compile(r"\[Shot\s+(\d+)\](?:\s+At\s+(\d{2}):(\d{2})\.(\d{3}),)?")
DIALOGUE_RE = re.compile(r"<d>\[([A-Za-z][A-Za-z-]*)\]\s*([\s\S]*?)</d>")
SPEAKER_RE = re.compile(r"\(S(\d+)(?:,S\d+)*\)")
CJK_RE = re.compile(r"[\u3400-\u9fff]")


@dataclass
class Result:
    ok: bool
    errors: list[str]
    warnings: list[str]
    stats: dict[str, object]


def section_map(text: str) -> tuple[list[str], dict[str, str]]:
    matches = list(FIELD_RE.finditer(text))
    names = [m.group(1) for m in matches]
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group(1)] = text[match.end():end].strip()
    return names, sections


def remove_dialogue(text: str) -> str:
    return re.sub(r"<d>[\s\S]*?</d>", "", text)


def parse_time(minutes: str, seconds: str, millis: str) -> float:
    return int(minutes) * 60 + int(seconds) + int(millis) / 1000


def validate(text: str, mode: str, duration: float) -> Result:
    errors: list[str] = []
    warnings: list[str] = []
    expected = REF_FIELDS if mode == "ref2va" else BASE_FIELDS
    names, sections = section_map(text)

    recognized = [name for name in names if name in set(BASE_FIELDS + REF_FIELDS)]
    if recognized != expected:
        errors.append(
            "Official field order mismatch: expected "
            + " -> ".join(expected)
            + "; found "
            + (" -> ".join(recognized) if recognized else "none")
        )
    for field in expected:
        if field not in sections:
            errors.append(f"Missing required field: {field}")
        elif not sections[field]:
            errors.append(f"Required field is empty: {field}")

    first_nonempty = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if mode == "t2va":
        if first_nonempty.startswith("For the target video") or first_nonempty.startswith(
            "How the reference pictures align"
        ):
            errors.append("T2VA must not begin with an image-alignment instruction")
    elif mode == "i2va":
        required = "For the target video, at 0.00 seconds into the target video"
        if not first_nonempty.startswith(required):
            errors.append("I2VA is missing the official 0.00-second first-frame instruction")
    elif mode in {"fl2va", "l2va"}:
        if not first_nonempty.startswith("How the reference pictures align with the target video"):
            errors.append(f"{mode.upper()} is missing the official picture-alignment instruction")
        duration_token = f"{duration:.2f}-second mark"
        if duration_token not in first_nonempty:
            errors.append(f"Alignment instruction must include {duration_token}")
        if mode == "fl2va" and "0.00-second mark" not in first_nonempty:
            errors.append("FL2VA alignment must include the 0.00-second opening frame")
    elif mode == "ref2va":
        if first_nonempty.startswith("For the target video") or first_nonempty.startswith(
            "How the reference pictures align"
        ):
            errors.append("Ref2VA must begin with subject_definitions, not a base-mode alignment line")

    main_field = "detailed_description" if mode == "ref2va" else "integrated_multimodal_description"
    body = sections.get(main_field, "")
    shot_matches = list(SHOT_RE.finditer(body))
    shot_numbers = [int(m.group(1)) for m in shot_matches]
    unique_shots: list[int] = []
    for number in shot_numbers:
        if not unique_shots or unique_shots[-1] != number:
            unique_shots.append(number)
    if not unique_shots or unique_shots[0] != 1:
        errors.append(f"{main_field} must begin its shot sequence with [Shot 1]")
    if unique_shots and unique_shots != list(range(1, max(unique_shots) + 1)):
        errors.append(f"Shot numbering must be sequential; found {unique_shots}")

    cut_times: list[float] = []
    for match in shot_matches:
        shot = int(match.group(1))
        has_time = match.group(2) is not None
        if shot == 1 and has_time:
            errors.append("[Shot 1] must not include a cut timestamp")
        if shot > 1 and not has_time:
            errors.append(f"[Shot {shot}] must include 'At MM:SS.mmm,'")
        if has_time:
            value = parse_time(match.group(2), match.group(3), match.group(4))
            cut_times.append(value)
            if value <= 0 or value >= duration:
                errors.append(f"[Shot {shot}] cut time {value:.3f}s is outside 0-{duration:.3f}s")
    if any(a >= b for a, b in zip(cut_times, cut_times[1:])):
        errors.append(f"Cut times must be strictly increasing; found {cut_times}")
    if duration <= 15 and len(unique_shots) > 4:
        warnings.append(f"{len(unique_shots)} shots in {duration:g}s may exceed the short-clip fidelity budget")

    if mode == "ref2va":
        declared = {(kind, int(number)) for kind, number in LABEL_RE.findall(sections.get("subject_definitions", ""))}
        used = {(kind, int(number)) for kind, number in LABEL_RE.findall(text)}
        missing = sorted(used - declared)
        for kind, number in missing:
            errors.append(f"Undefined reference label: <{kind} {number}>")
    else:
        used = {(kind, int(number)) for kind, number in LABEL_RE.findall(text)}
        if mode == "t2va" and used:
            errors.append("T2VA contains reference labels but has no reference input contract")

    all_labels = {(kind, int(number)) for kind, number in LABEL_RE.findall(text)}
    for kind in ("Subject", "Picture", "Video", "Audio"):
        numbers = sorted({number for label_kind, number in all_labels if label_kind == kind})
        if numbers and numbers != list(range(1, max(numbers) + 1)):
            errors.append(f"{kind} numbering must be contiguous from 1; found {numbers}")

    open_count = text.count("<d>")
    close_count = text.count("</d>")
    dialogues = DIALOGUE_RE.findall(text)
    if open_count != close_count or len(dialogues) != open_count:
        errors.append("Dialogue tags are unbalanced or lack a valid [Language] tag")
    for language, words in dialogues:
        if not words.strip():
            errors.append(f"Empty dialogue block for language {language}")

    speaker_numbers = sorted({int(number) for number in SPEAKER_RE.findall(text)})
    if speaker_numbers and speaker_numbers != list(range(1, max(speaker_numbers) + 1)):
        errors.append(f"Speaker numbering must be contiguous from S1; found {speaker_numbers}")

    if re.search(r"@(Image|Video|Audio)\s*\d+", text, flags=re.IGNORECASE):
        errors.append("Seedance-style @Image/@Video/@Audio tags are not valid H3 reference labels")

    if re.search(r"(?i)\b(TODO|TBD)\b|S\.SS|\[Shot N\]|<Picture N>|<Subject N>", text):
        errors.append("Prompt contains unresolved placeholders")

    internal_terms = [
        "dramatic function:",
        "power shift:",
        "hidden want:",
        "objective:",
        "stock solution refused:",
        "visible suppressed behavior:",
    ]
    for term in internal_terms:
        if term.lower() in text.lower():
            errors.append(f"Internal Director's Read label leaked into the H3 prompt: {term}")

    if CJK_RE.search(remove_dialogue(text)):
        warnings.append("CJK text exists outside <d> dialogue blocks; verify it is intentional visible scene text")

    if mode == "ref2va" and body:
        word_count = len(re.findall(r"\b[A-Za-z][A-Za-z'-]*\b", body))
        if word_count < 350 or word_count > 500:
            warnings.append(
                f"Ref2VA detailed_description has about {word_count} English words; official guidance normally uses 350-500"
            )
    else:
        word_count = len(re.findall(r"\b[A-Za-z][A-Za-z'-]*\b", body)) if body else 0

    for field in ("overall_soundscape", "non_diegetic_music"):
        value = sections.get(field, "")
        if value and value != "N/A" and len(value.split()) < 3:
            warnings.append(f"{field} is unusually short")

    stats = {
        "mode": mode,
        "duration_seconds": duration,
        "fields": recognized,
        "shots": unique_shots,
        "cut_times_seconds": cut_times,
        "reference_labels": sorted(f"<{kind} {number}>" for kind, number in all_labels),
        "speakers": [f"S{number}" for number in speaker_numbers],
        "dialogue_blocks": len(dialogues),
        "main_description_word_count": word_count,
    }
    return Result(ok=not errors, errors=errors, warnings=warnings, stats=stats)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", type=Path)
    parser.add_argument(
        "--mode",
        required=True,
        choices=["t2va", "i2va", "fl2va", "l2va", "ref2va"],
    )
    parser.add_argument("--duration", required=True, type=float)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    if args.duration <= 0 or args.duration > 15:
        parser.error("--duration must be greater than 0 and no more than 15 seconds")
    try:
        text = args.prompt.read_text(encoding="utf-8-sig")
    except OSError as exc:
        print(f"ERROR: cannot read {args.prompt}: {exc}", file=sys.stderr)
        return 2

    result = validate(text, args.mode, args.duration)
    if args.as_json:
        print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    else:
        print("PASS" if result.ok else "FAIL")
        for error in result.errors:
            print(f"ERROR: {error}")
        for warning in result.warnings:
            print(f"WARNING: {warning}")
        print("STATS: " + json.dumps(result.stats, ensure_ascii=False, sort_keys=True))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

