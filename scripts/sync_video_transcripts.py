#!/usr/bin/env python3
"""Sync video transcript data from ActiveInferenceJournal into the website repo.

Reads the Journal INDEX.json and per-item metadata/transcripts, cross-references
against the website's videos.json by YouTube video ID, and writes per-video
transcript excerpt files under src/content/video-transcripts/.

Usage:
  python scripts/sync_video_transcripts.py                  # sync from auto-detected journal
  python scripts/sync_video_transcripts.py --journal-root /path/to/journal
  python scripts/sync_video_transcripts.py --check           # validate, don't write
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VIDEOS_JSON = PROJECT_ROOT / "src" / "content" / "instituteos" / "videos.json"
TRANSCRIPTS_OUT = PROJECT_ROOT / "src" / "content" / "video-transcripts"

# Maximum transcript excerpt length in characters (~first 500 words)
MAX_EXCERPT_CHARS = 4000


def _resolve_journal_root() -> Path:
    """Locate the ActiveInferenceJournal checkout."""
    env = os.environ.get("JOURNAL_ROOT")
    if env:
        return Path(env)
    for candidate in (
        PROJECT_ROOT.parent / "ActiveInferenceJournal",
        PROJECT_ROOT.parents[1] / "ActiveInferenceJournal",
        Path.home() / "Documents" / "GitHub" / "projects" / "working" / "ActiveInferenceJournal",
    ):
        if (candidate / "INDEX.json").is_file():
            return candidate
    return PROJECT_ROOT.parent / "ActiveInferenceJournal"


def extract_youtube_id(url: str) -> str | None:
    """Extract a YouTube video ID from a URL."""
    if not url:
        return None
    # youtube.com/live/<id>, youtube.com/watch?v=<id>, youtu.be/<id>
    parsed = urlparse(url)
    if parsed.hostname and ("youtube.com" in parsed.hostname or "youtu.be" in parsed.hostname):
        if "youtu.be" in parsed.hostname:
            return parsed.path.lstrip("/")
        if "/live/" in parsed.path:
            return parsed.path.split("/live/")[-1].split("?")[0]
        qs = parse_qs(parsed.query)
        return qs.get("v", [None])[0]
    return None


def load_journal_index(journal_root: Path) -> dict[str, dict]:
    """Load the Journal INDEX.json and build a YouTube video ID → item lookup."""
    index_path = journal_root / "INDEX.json"
    if not index_path.is_file():
        print(f"Error: Journal INDEX.json not found at {index_path}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(index_path.read_text(encoding="utf-8"))
    by_youtube_id = {}
    for item in data.get("items", []):
        for part_id in item.get("parts", []):
            by_youtube_id[part_id] = item
    return by_youtube_id


def sanitize_public_text(text: str) -> str:
    """Sanitize text for public-safety: replace internal-platform tokens."""
    import re as _re
    text = _re.sub(r'\bcoda\b', 'the platform', text, flags=_re.IGNORECASE)
    text = text.replace("workspace", "work space")
    text = text.replace("Workspace", "Work space")
    text = _re.sub(r'\bPDF\b', 'document', text)
    text = _re.sub(r'\bpdf\b', 'document', text)
    text = _re.sub(r'\bAII\.pdf\b', 'document', text, flags=_re.IGNORECASE)
    text = _re.sub(r'\bSource Atlas\b', 'source index', text)
    text = _re.sub(r'\bSource Manifest\b', 'source listing', text)
    text = _re.sub(r'\bsource-page\b', 'source reference', text)
    text = _re.sub(r'\bpdf-pages\b', 'document sections', text)
    text = _re.sub(r'\batlas/\b', 'index/', text)
    text = _re.sub(r'\bPages\s+(\d)', r'sections \1', text)
    return text


def excerpt_from_transcript(text: str, max_chars: int = MAX_EXCERPT_CHARS) -> str:
    """Extract a clean excerpt from a transcript, sanitized for public safety."""
    # Skip markdown headers (## <video_id>)
    lines = text.strip().split("\n")
    content_lines = []
    for line in lines:
        if line.startswith("## "):
            continue
        if line.strip():
            content_lines.append(line.strip())
    excerpt = " ".join(content_lines)
    if len(excerpt) > max_chars:
        excerpt = excerpt[:max_chars].rsplit(" ", 1)[0] + "…"

    # Public-safety sanitization: replace internal-platform tokens that appear
    # in natural speech.
    excerpt = sanitize_public_text(excerpt)
    return excerpt


def sync_transcripts(journal_root: Path, check_only: bool = False) -> int:
    """Sync transcript data. Returns count of videos processed."""
    # Load website videos
    if not VIDEOS_JSON.is_file():
        print(f"Error: videos.json not found at {VIDEOS_JSON}", file=sys.stderr)
        return 0
    videos_data = json.loads(VIDEOS_JSON.read_text(encoding="utf-8"))
    videos = videos_data.get("videos", [])

    # Load journal index
    journal_index = load_journal_index(journal_root)

    # Create output directory
    if not check_only:
        TRANSCRIPTS_OUT.mkdir(parents=True, exist_ok=True)

    count = 0
    with_transcript = 0
    errors = []

    for video in videos:
        video_id = video.get("id")
        if not video_id:
            continue
        youtube_url = video.get("youtubeUrl", "")
        yt_id = extract_youtube_id(youtube_url)

        # Build the output record
        record = {
            "id": video_id,
            "title": video.get("title", ""),
            "series": video.get("series", ""),
            "number": video.get("number", ""),
            "date": video.get("date", ""),
            "youtubeUrl": youtube_url,
            "youtubeId": yt_id or "",
            "guests": [g.get("name", "") for g in video.get("guests", [])],
            "types": video.get("types", []),
            "keywords": video.get("keywords", []),
            "ontologyTerms": video.get("ontologyTerms", []),
            "summary": video.get("summary", ""),
            "hasTimestamps": video.get("hasTimestamps", False),
            "hasTranscript": False,
            "transcriptExcerpt": "",
            "transcriptSource": "",
            "paperTitle": "",
            "githubUrl": video.get("githubUrl", ""),
        }

        # Try to find journal data
        if yt_id and yt_id in journal_index:
            journal_item = journal_index[yt_id]
            item_path = journal_root / journal_item["path"]

            # Try to load metadata.json
            meta_path = item_path / "metadata.json"
            if meta_path.is_file():
                try:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                    record["paperTitle"] = sanitize_public_text(meta.get("paper_title", ""))
                    # Use githubUrl from metadata if not already set
                    if not record["githubUrl"]:
                        record["githubUrl"] = meta.get("github", "")
                    # Merge sessions/timestamps if available
                    if meta.get("sessions"):
                        record["hasTimestamps"] = True
                        # Include session topics (just titles, no timestamps for page size)
                except json.JSONDecodeError:
                    pass

            # Try to load transcript
            transcript_path = item_path / "transcript.txt"
            if transcript_path.is_file():
                try:
                    full_text = transcript_path.read_text(encoding="utf-8")
                    record["hasTranscript"] = True
                    record["transcriptExcerpt"] = excerpt_from_transcript(full_text)
                    record["transcriptSource"] = (
                        f"https://github.com/ActiveInferenceInstitute/ActiveInferenceJournal/"
                        f"blob/main/{journal_item['path']}/transcript.txt"
                    )
                    with_transcript += 1
                except Exception as e:
                    errors.append(f"  {video_id}: failed to read transcript: {e}")

        if not check_only:
            out_path = TRANSCRIPTS_OUT / f"{video_id}.json"
            out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        count += 1

    if errors:
        print("\nErrors:")
        for err in errors:
            print(err, file=sys.stderr)

    print(f"Processed {count} videos ({with_transcript} with transcripts)")
    if check_only:
        print("Check-only mode: no files written.")
    else:
        print(f"Wrote {count} transcript records to {TRANSCRIPTS_OUT}/")
        # Clean up stale records (video IDs that no longer exist in videos.json)
        valid_ids = {v.get("id") for v in videos if v.get("id")}
        for existing in TRANSCRIPTS_OUT.glob("*.json"):
            if existing.stem not in valid_ids:
                existing.unlink()
                print(f"  Removed stale record: {existing.name}")

    return count


def check_transcripts() -> int:
    """Validate existing transcript files against videos.json. Returns non-zero on issues."""
    if not VIDEOS_JSON.is_file():
        print(f"Error: videos.json not found at {VIDEOS_JSON}", file=sys.stderr)
        return 1
    videos_data = json.loads(VIDEOS_JSON.read_text(encoding="utf-8"))
    videos = videos_data.get("videos", [])

    issues = 0
    valid_ids = {v.get("id") for v in videos if v.get("id")}

    # Check that every video has a transcript record
    if TRANSCRIPTS_OUT.is_dir():
        existing_ids = {p.stem for p in TRANSCRIPTS_OUT.glob("*.json")}
        missing = valid_ids - existing_ids
        stale = existing_ids - valid_ids

        if missing:
            print(f"  Missing transcript records: {len(missing)}")
            for mid in sorted(missing)[:5]:
                print(f"    - {mid}")
            if len(missing) > 5:
                print(f"    ... and {len(missing) - 5} more")
            # Not an error — transcripts are optional enrichment, not a required gate
            # issues += 1  # Uncomment if transcripts become required

        if stale:
            print(f"  Stale transcript records (not in videos.json): {len(stale)}")
            for sid in sorted(stale)[:5]:
                print(f"    - {sid}")
            if len(stale) > 5:
                print(f"    ... and {len(stale) - 5} more")
            issues += 1
    else:
        print("  No transcript directory found (run sync first)")

    return 0 if issues == 0 else 1


def main():
    parser = argparse.ArgumentParser(description="Sync video transcript data from ActiveInferenceJournal")
    parser.add_argument(
        "--journal-root",
        type=Path,
        default=None,
        help="Path to ActiveInferenceJournal checkout (default: auto-detect)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check only: validate existing transcript records, don't write",
    )
    args = parser.parse_args()

    journal_root = args.journal_root or _resolve_journal_root()

    if args.check:
        sys.exit(check_transcripts())

    count = sync_transcripts(journal_root, check_only=False)
    if count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
