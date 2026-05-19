#!/usr/bin/env python3
"""Fetch match data online and store raw artifacts for parsing."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List
from urllib.request import Request, urlopen


RAW_DIR = Path("data/raw_scorecards")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch match scorecard page and extract embedded data blobs.")
    parser.add_argument("--match-id", required=True, help="Internal match id (e.g. IPL2026-021).")
    parser.add_argument("--url", required=True, help="Scorecard URL.")
    parser.add_argument(
        "--source",
        default="cricbuzz",
        choices=["cricbuzz", "espncricinfo", "generic"],
        help="Data source type.",
    )
    return parser.parse_args()


def fetch_html(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
        },
    )
    with urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def try_extract_json_blobs(html: str) -> List[Dict[str, Any]]:
    candidates = []

    patterns = [
        r"__NEXT_DATA__\"\s*type=\"application/json\"\s*>\s*(\{.*?\})\s*<",
        r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});",
        r"window\.__data\s*=\s*(\{.*?\});",
        r"\"scorecard\":\s*(\{.*?\})\s*,\s*\"commentary\"",
    ]

    for pattern in patterns:
        for m in re.finditer(pattern, html, flags=re.DOTALL):
            txt = m.group(1).strip()
            try:
                obj = json.loads(txt)
                candidates.append(obj)
            except Exception:
                continue
    return candidates


def main() -> None:
    args = parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    html = fetch_html(args.url)
    html_path = RAW_DIR / f"{args.match_id}__{args.source}.html"
    html_path.write_text(html, encoding="utf-8")

    blobs = try_extract_json_blobs(html)
    blobs_path = RAW_DIR / f"{args.match_id}__{args.source}__blobs.json"
    blobs_path.write_text(json.dumps(blobs, indent=2, ensure_ascii=True), encoding="utf-8")

    meta = {
        "match_id": args.match_id,
        "source": args.source,
        "url": args.url,
        "html_file": str(html_path),
        "blob_file": str(blobs_path),
        "embedded_blob_count": len(blobs),
        "note": "If blob_count is 0, use manual normalization file with convert_scorecard_to_fantasy.py.",
    }
    meta_path = RAW_DIR / f"{args.match_id}__{args.source}__meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=True), encoding="utf-8")

    print(f"Fetched HTML: {html_path}")
    print(f"Extracted blobs: {len(blobs)} -> {blobs_path}")
    print(f"Metadata: {meta_path}")


if __name__ == "__main__":
    main()
