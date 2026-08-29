#!/usr/bin/env python3
"""Validate the eight-step H3 Director contract before prompt compilation."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


STEP_RULES = [
    ("资产", re.compile(r"资产|Picture|ref_image|文件", re.I)),
    ("空间", re.compile(r"空间|轴线|左右|位置|方向|接触", re.I)),
    ("首帧", re.compile(r"首帧|first\s+frame|Picture\s*1|ref_image_0", re.I)),
    ("镜头", re.compile(r"镜头|运镜|运动|跟拍|推进|固定|终点|camera|shot", re.I)),
    ("动作", re.compile(r"动作|触发|受力|重力|结果|physics|action", re.I)),
    ("声音", re.compile(r"声音|对白|口型|环境声|动作声|静默|sound|dialogue|audio", re.I)),
    ("尾帧", re.compile(r"尾帧|最后一帧|last\s+frame|end\s+frame|handoff", re.I)),
    ("修正", re.compile(r"连续|修正|KEEP|POST-FIX|REROLL|REWRITE|continuity|repair", re.I)),
]
HEADING_RE = re.compile(r"(?im)^##\s*(?:step\s*)?([1-8])(?:[.)：:\-]|\s+)(.*)$")
VERDICT_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:verdict|结论|验收结论)\s*[:：]\s*`?(KEEP|POST-FIX|REROLL|REWRITE)\b"
)
PLACEHOLDER_RE = re.compile(r"\b(?:TODO|TBD)\b|待定|<Picture\s+N>|<Subject\s+N>", re.I)


@dataclass
class Result:
    ok: bool
    errors: list[str]
    warnings: list[str]
    stats: dict[str, object]


def parse_sections(text: str) -> tuple[list[int], dict[int, str]]:
    matches = list(HEADING_RE.finditer(text))
    numbers = [int(match.group(1)) for match in matches]
    sections: dict[int, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[int(match.group(1))] = text[match.end() : end].strip()
    return numbers, sections


def validate(text: str, connected: bool = False) -> Result:
    errors: list[str] = []
    warnings: list[str] = []
    numbers, sections = parse_sections(text)
    expected = list(range(1, 9))

    if numbers != expected:
        errors.append(f"Director contract headings must be exactly 1-8 in order; found {numbers or 'none'}")
    for number, (label, pattern) in enumerate(STEP_RULES, start=1):
        if number not in sections:
            continue
        if not sections[number]:
            errors.append(f"Step {number} ({label}) is empty")
        elif not pattern.search(sections[number]):
            errors.append(f"Step {number} ({label}) is missing its required observable content")

    if PLACEHOLDER_RE.search(text):
        errors.append("Director contract contains an unresolved placeholder")

    verdicts = VERDICT_RE.findall(sections.get(8, ""))
    if len(verdicts) != 1:
        errors.append("Step 8 must state exactly one explicit verdict: KEEP, POST-FIX, REROLL, or REWRITE")

    if connected:
        lower = text.lower()
        if "ref_image_0" not in lower or "<picture 1>" not in lower:
            errors.append("Connected contract must identify the next <Picture 1> / ref_image_0 handoff")
        if not re.search(r"真实尾帧|实际尾帧|验收尾帧|accepted\s+(?:real\s+)?end\s+frame|observed\s+end\s+frame", text, re.I):
            errors.append("Connected contract must identify an accepted/observed real end frame")
        if not re.search(r"验收|accepted|canon", text, re.I):
            errors.append("Connected contract must name the accepted source or canon state")

    if 8 in sections and not re.search(r"source|文件|记录|问题|原因|变量|change|observation", sections[8], re.I):
        warnings.append("Step 8 has a verdict but little repair evidence; record observation, changed variable, and outcome")

    stats = {
        "connected": connected,
        "headings": numbers,
        "verdicts": verdicts,
        "steps_present": sorted(sections),
    }
    return Result(ok=not errors, errors=errors, warnings=warnings, stats=stats)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract", type=Path)
    parser.add_argument("--connected", action="store_true", help="require a real accepted end-frame handoff")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    try:
        text = args.contract.read_text(encoding="utf-8-sig")
    except OSError as exc:
        print(f"ERROR: cannot read {args.contract}: {exc}", file=sys.stderr)
        return 2

    result = validate(text, connected=args.connected)
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
