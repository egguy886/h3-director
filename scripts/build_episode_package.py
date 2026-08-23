#!/usr/bin/env python3
"""Build a self-contained H3 Director episode package and merged HTML report."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--episode-id", required=True, help="Stable ID, for example EP001")
    p.add_argument("--title", default="", help="Human-readable episode title")
    p.add_argument("--source", default="", help="Canonical script/source path")
    p.add_argument("--out", required=True, type=Path, help="Episode package output directory")
    p.add_argument("--prompts-dir", type=Path, help="Directory containing .txt H3 prompts")
    p.add_argument("--assets-root", action="append", default=[], metavar="CATEGORY=DIR", help="Copy a directory into assets/CATEGORY; repeat as needed")
    p.add_argument("--upload-map", type=Path, help="Upload map Markdown file")
    p.add_argument("--continuity", type=Path, help="Continuity handoff Markdown file")
    p.add_argument("--art-json", type=Path, help="novel-art JSON to copy into report/")
    p.add_argument("--novel-art-report", type=Path, help="Rendered novel-art art-report.html to copy")
    p.add_argument("--novel-art-images", type=Path, help="Directory containing images referenced by art-report.html")
    p.add_argument("--mode", default="ref2va", choices=["t2va", "i2va", "fl2va", "l2va", "ref2va"])
    p.add_argument("--duration", type=float, default=15.0, help="Prompt duration for validation")
    p.add_argument("--force", action="store_true", help="Allow writing into a non-empty output directory")
    return p.parse_args()


def fail(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def copy_file(src: Path, dst: Path) -> Path:
    if not src.is_file():
        fail(f"File not found: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return dst


def copy_tree(src: Path, dst: Path) -> list[Path]:
    if not src.is_dir():
        fail(f"Directory not found: {src}")
    copied: list[Path] = []
    for item in sorted(src.rglob("*")):
        if item.is_file():
            target = dst / item.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)
            copied.append(target)
    return copied


def asset_kind(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in IMAGE_EXTS:
        return "image"
    if suffix in VIDEO_EXTS:
        return "video"
    if suffix in AUDIO_EXTS:
        return "audio"
    return "file"


def rel_link(path: Path, root: Path) -> str:
    return Path(os.path.relpath(path, root)).as_posix()


def normalize_upload_map(src: Path, dst: Path, package_root: Path, assets: list[Path]) -> None:
    """Copy the source map while replacing external file paths with local package paths."""
    text = src.read_text(encoding="utf-8-sig")
    # The canonical map often contains absolute Windows paths. Replace only the
    # path ending in a known copied filename, leaving labels and ordering intact.
    for asset in sorted(assets, key=lambda item: len(item.name), reverse=True):
        filename = re.escape(asset.name)
        local = rel_link(asset, package_root)
        pattern = re.compile(rf"(?i)(?:(?P<tick>`)|(?P<drive>[A-Za-z]:[\\/]))[^`\r\n]*?{filename}")
        text = pattern.sub(lambda match: (match.group("tick") or "") + local, text)
    header = (
        "> This is the packaged copy. Asset paths were normalized to this folder; "
        "Picture numbering and ComfyUI node offsets are unchanged.\n\n"
    )
    index = ["\n\n## Package-local asset index\n\n", "| Category | File | Package path |\n", "|---|---|---|\n"]
    for asset in sorted(assets, key=lambda item: (item.relative_to(package_root / "assets").parts[0], item.name.lower())):
        category = asset.relative_to(package_root / "assets").parts[0]
        index.append(f"| `{category}` | `{asset.name}` | `{rel_link(asset, package_root)}` |\n")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(header + text.rstrip() + "".join(index), encoding="utf-8")


def validate_prompt(prompt: Path, mode: str, duration: float) -> dict[str, object]:
    validator = Path(__file__).with_name("validate_h3_prompt.py")
    command = [sys.executable, str(validator), str(prompt), "--mode", mode, "--duration", str(duration), "--json"]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "errors": [result.stderr.strip() or result.stdout.strip()], "warnings": [], "stats": {}}


def prompt_cards(prompts: list[Path], report_root: Path, validations: dict[str, dict[str, object]]) -> str:
    cards: list[str] = []
    for prompt in prompts:
        rel = rel_link(prompt, report_root)
        result = validations[prompt.name]
        status = "PASS" if result.get("ok") else "FAIL"
        stats = result.get("stats") or {}
        cuts = ", ".join(str(x) for x in stats.get("cut_times_seconds", []))
        body = html.escape(prompt.read_text(encoding="utf-8-sig"))
        cards.append(f"""<article class=\"prompt-card\">
  <div class=\"card-head\"><h3>{html.escape(prompt.stem)}</h3><span class=\"badge {status.lower()}\">{status}</span></div>
  <p class=\"meta\">{html.escape(rel)} · cuts: {html.escape(cuts or 'none')}</p>
  <div class=\"actions\"><button data-copy=\"{html.escape(rel)}\">Copy prompt</button><a href=\"{html.escape(rel)}\" download>Download .txt</a></div>
  <details><summary>Preview full prompt</summary><pre>{body}</pre></details>
</article>""")
    return "\n".join(cards) or '<p class="muted">No prompt files were supplied.</p>'


def asset_cards(assets: list[Path], report_root: Path) -> str:
    groups: dict[str, list[Path]] = {}
    for path in assets:
        category = path.relative_to(report_root.parent / "assets").parts[0]
        groups.setdefault(category, []).append(path)
    sections: list[str] = []
    for category in sorted(groups):
        cards: list[str] = []
        for path in groups[category]:
            rel = rel_link(path, report_root)
            kind = asset_kind(path)
            label = html.escape(path.name)
            if kind == "image":
                preview = f'<img loading="lazy" src="{html.escape(rel)}" alt="{label}">'
            elif kind == "video":
                preview = f'<video controls preload="metadata" src="{html.escape(rel)}"></video>'
            elif kind == "audio":
                preview = f'<audio controls preload="metadata" src="{html.escape(rel)}"></audio>'
            else:
                preview = '<div class="file-icon">FILE</div>'
            cards.append(f'<article class="asset-card">{preview}<div class="asset-name">{label}</div><a href="{html.escape(rel)}" download>Open / download</a></article>')
        sections.append(f'<section class="asset-group"><h3>{html.escape(category)}</h3><div class="asset-grid">{"".join(cards)}</div></section>')
    return "\n".join(sections) or '<p class="muted">No assets were supplied.</p>'


CSS = r""":root{--bg:#0b0f14;--panel:#121923;--panel2:#182330;--ink:#edf4fb;--muted:#9eafbf;--accent:#ff7043;--ok:#43d17a;--fail:#ff6374;--line:#263443}
*{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at 10% 0%,#172636 0,#0b0f14 42%);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif} main{max-width:1440px;margin:0 auto;padding:34px 28px 70px} h1,h2,h3{line-height:1.2;margin:0 0 12px} h1{font-size:34px;letter-spacing:-.02em} h2{font-size:22px;margin-top:38px} h3{font-size:16px} a{color:#ffad8d;text-decoration:none} a:hover{text-decoration:underline} .eyebrow{color:var(--accent);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:12px} .lead{color:var(--muted);max-width:800px} .hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;border-bottom:1px solid var(--line);padding-bottom:26px} .buttons{display:flex;gap:10px;flex-wrap:wrap} .button,button{border:1px solid #385067;background:var(--panel2);border-radius:9px;padding:9px 13px;color:var(--ink);cursor:pointer;font:inherit} .button:hover,button:hover{border-color:var(--accent);text-decoration:none} .secondary{color:var(--muted)} .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0} .kpi{background:rgba(18,25,35,.86);border:1px solid var(--line);border-radius:14px;padding:16px} .kpi strong{display:block;font-size:28px} .kpi span{color:var(--muted);font-size:12px} .panel{background:rgba(18,25,35,.82);border:1px solid var(--line);border-radius:16px;padding:20px;margin-top:18px} .prompt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:14px} .prompt-card,.asset-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:15px} .card-head{display:flex;justify-content:space-between;gap:12px;align-items:center} .badge{font-size:11px;padding:4px 8px;border-radius:999px;font-weight:700} .badge.pass{color:#062c17;background:var(--ok)} .badge.fail{color:#35060c;background:var(--fail)} .meta,.muted{color:var(--muted);font-size:12px;word-break:break-word} .actions{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap} details{border-top:1px solid var(--line);padding-top:10px} summary{cursor:pointer;color:#ffad8d} pre{white-space:pre-wrap;max-height:420px;overflow:auto;background:#080b10;border-radius:9px;padding:12px;color:#d5e3ee;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace} .asset-group{margin-top:22px} .asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px} .asset-card img,.asset-card video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#080b10;border-radius:8px;margin-bottom:10px} .asset-card audio{width:100%;margin:28px 0} .file-icon{height:124px;display:grid;place-items:center;background:#080b10;border-radius:8px;color:var(--muted);font-weight:700;margin-bottom:10px} .asset-name{font-size:13px;word-break:break-word;margin-bottom:7px} .manifest{max-height:500px;overflow:auto} @media(max-width:800px){main{padding:24px 16px} .hero{display:block} .kpis{grid-template-columns:repeat(2,1fr)}}
"""


def build_report(out: Path, episode_id: str, title: str, source: str, prompts: list[Path], assets: list[Path], validations: dict[str, dict[str, object]], art_json: Path | None, novel_art_report: Path | None) -> None:
    report_dir = out / "report"
    passed = sum(1 for value in validations.values() if value.get("ok"))
    categories = sorted({p.relative_to(out / "assets").parts[0] for p in assets}) if assets else []
    aux_links: list[str] = []
    aux_manifest: dict[str, str | None] = {}
    for folder, label in (("upload-map", "Upload map"), ("continuity", "Continuity")):
        files = sorted((out / folder).glob("*"))
        first = next((item for item in files if item.is_file()), None)
        aux_manifest[folder] = rel_link(first, report_dir) if first else None
        if first:
            aux_links.append(f'<a class="button secondary" href="{html.escape(rel_link(first, report_dir))}">{label}</a>')
    manifest = {
        "episodeId": episode_id,
        "title": title,
        "source": source,
        "generatedAtUtc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "prompts": [{"file": rel_link(p, report_dir), "validation": validations[p.name]} for p in prompts],
        "assets": [{"file": rel_link(p, report_dir), "category": p.relative_to(out / "assets").parts[0], "kind": asset_kind(p), "bytes": p.stat().st_size} for p in assets],
        "packageLinks": aux_manifest,
        "reports": {"novelArtJson": rel_link(art_json, report_dir) if art_json else None, "novelArtReport": rel_link(novel_art_report, report_dir) if novel_art_report else None},
    }
    (report_dir / "episode-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest_json = html.escape(json.dumps(manifest, ensure_ascii=False, indent=2))
    art_link = '<a class="button" href="art-report.html">Open full novel-art report</a>' if novel_art_report else ''
    art_data_link = f'<a class="button secondary" href="{html.escape(rel_link(art_json, report_dir))}">Open art.json</a>' if art_json else ''
    report = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(episode_id)} · H3 Director Episode Package</title><style>{CSS}</style></head><body><main>
<header class="hero"><div><div class="eyebrow">H3 Director · Episode Package</div><h1>{html.escape(episode_id)}{(' · ' + html.escape(title)) if title else ''}</h1><p class="lead">A single production folder for H3 prompts, ComfyUI references, continuity records, and the merged visual-asset report.</p><p class="meta">Canonical source: {html.escape(source or 'not supplied')}</p></div><div class="buttons">{art_link}{art_data_link}<a class="button secondary" href="episode-manifest.json">Download manifest</a></div></header>
<section class="kpis"><div class="kpi"><strong>{len(prompts)}</strong><span>H3 prompt files</span></div><div class="kpi"><strong>{len(assets)}</strong><span>visual/audio assets</span></div><div class="kpi"><strong>{len(categories)}</strong><span>asset categories</span></div><div class="kpi"><strong>{passed}/{len(prompts)}</strong><span>validator passes</span></div></section>
<section class="panel"><h2>Package links</h2><div class="buttons">{''.join(aux_links)}{art_link}{art_data_link}<a class="button secondary" href="episode-manifest.json">Download manifest</a></div></section>
<section class="panel"><h2>Prompts</h2><p class="muted">Each prompt is ready to paste into H3. Validation checks field order, references, shot timing, speaker IDs, dialogue tags, and duration.</p><div class="prompt-grid">{prompt_cards(prompts, report_dir, validations)}</div></section>
<section class="panel"><h2>Assets</h2><p class="muted">Images are previewed in place; videos and audio remain downloadable for ComfyUI reference nodes.</p>{asset_cards(assets, report_dir)}</section>
<section class="panel"><h2>Manifest</h2><pre class="manifest" id="manifest">{manifest_json}</pre></section>
</main><script>document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{{try{{const r=await fetch(b.dataset.copy);const t=await r.text();await navigator.clipboard.writeText(t);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}}catch(e){{window.open(b.dataset.copy,'_blank')}}}}));</script></body></html>"""
    (report_dir / "episode-report.html").write_text(report, encoding="utf-8")


def write_package_readme(out: Path, episode_id: str, title: str, source: str) -> None:
    text = f"""# {episode_id}{(' — ' + title) if title else ''}

This folder is a self-contained H3 Director episode package. Open `report/episode-report.html` first.

## Layout

- `prompts/` — paste-ready MiniMax H3 prompts.
- `assets/` — reference images, keyframes, audio, and other upload material grouped by authority.
- `upload-map/` — Picture 1 → `ref_image_0` mapping.
- `continuity/` — planned and observed endpoints.
- `report/` — merged report, manifest, and optional novel-art report.

Canonical source: `{source or 'not supplied'}`

Do not renumber Pictures when uploading. H3 Picture 1 maps to ComfyUI `ref_image_0`; the offset is intentional.
"""
    (out / "README.md").write_text(text, encoding="utf-8")


def main() -> int:
    args = parse_args()
    out = args.out.resolve()
    if out.exists() and any(out.iterdir()) and not args.force:
        fail(f"Output directory is not empty (use --force only when you intend to replace it): {out}")
    out.mkdir(parents=True, exist_ok=True)
    for dirname in ("prompts", "assets", "upload-map", "continuity", "report"):
        (out / dirname).mkdir(exist_ok=True)

    prompts: list[Path] = []
    if args.prompts_dir:
        for src in sorted(args.prompts_dir.glob("*.txt")):
            prompts.append(copy_file(src, out / "prompts" / src.name))

    assets: list[Path] = []
    for spec in args.assets_root:
        if "=" not in spec:
            fail(f"--assets-root must use CATEGORY=DIR: {spec}")
        category, raw_dir = spec.split("=", 1)
        category = category.strip().strip("/\\")
        if not category or Path(category).name != category:
            fail(f"Invalid asset category: {category}")
        assets.extend(copy_tree(Path(raw_dir).resolve(), out / "assets" / category))

    if args.upload_map:
        normalize_upload_map(args.upload_map.resolve(), out / "upload-map" / args.upload_map.name, out, assets)
    if args.continuity:
        copy_file(args.continuity.resolve(), out / "continuity" / args.continuity.name)

    art_json: Path | None = None
    if args.art_json:
        art_json = copy_file(args.art_json.resolve(), out / "report" / args.art_json.name)
    novel_art_report: Path | None = None
    if args.novel_art_report:
        novel_art_report = copy_file(args.novel_art_report.resolve(), out / "report" / "art-report.html")
    if args.novel_art_images:
        copy_tree(args.novel_art_images.resolve(), out / "report" / "images")

    validations = {prompt.name: validate_prompt(prompt, args.mode, args.duration) for prompt in prompts}
    (out / "report" / "validation.json").write_text(json.dumps(validations, ensure_ascii=False, indent=2), encoding="utf-8")
    build_report(out, args.episode_id, args.title, args.source, prompts, assets, validations, art_json, novel_art_report)
    write_package_readme(out, args.episode_id, args.title, args.source)
    failures = [name for name, value in validations.items() if not value.get("ok")]
    print(json.dumps({"package": str(out), "prompts": len(prompts), "assets": len(assets), "validation_failures": failures}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
