#!/usr/bin/env python3
"""Project public Journal transcript excerpts into the website video records.

Use --check for a checkout-independent record check. Add --journal-root (or
JOURNAL_ROOT) to compare against a fresh projection of that Journal checkout.
The command writes only when run without --check.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile
from urllib.parse import parse_qs, quote, unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
VIDEOS_JSON = PROJECT_ROOT / "src/content/instituteos/videos.json"
TRANSCRIPTS_OUT = PROJECT_ROOT / "src/content/video-transcripts"
MAX_EXCERPT_CHARS = 4000
JOURNAL_DATA_DIR = "data/video/activeinferenceinstitute"
JOURNAL_BLOB_BASE = (
    "https://github.com/ActiveInferenceInstitute/ActiveInferenceJournal/blob/main/"
)
YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")
VIDEO_RECORD_ID = re.compile(r"[A-Za-z0-9_-]+")
YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "m.youtube.com"}


def extract_youtube_id(url: str) -> str | None:
    """Extract a single video ID from a supported YouTube URL."""
    if not isinstance(url, str):
        return None
    try:
        parsed = urlsplit(url)
    except ValueError:
        return None
    if (
        parsed.scheme not in {"https", "http"}
        or parsed.netloc.lower() != parsed.hostname
    ):
        return None

    parts = parsed.path.removeprefix("/").removesuffix("/").split("/")
    if parsed.hostname == "youtu.be" and len(parts) == 1:
        candidate = parts[0]
    elif (
        parsed.hostname in YOUTUBE_HOSTS
        and len(parts) == 2
        and parts[0] in {"live", "shorts", "embed"}
    ):
        candidate = parts[1]
    elif parsed.hostname in YOUTUBE_HOSTS and parts == ["watch"]:
        ids = parse_qs(parsed.query).get("v", [])
        candidate = ids[0] if len(ids) == 1 else ""
    else:
        return None
    return candidate if YOUTUBE_ID.fullmatch(candidate) else None


def public_item_path(path: object) -> bool:
    return (
        isinstance(path, str)
        and path.startswith(JOURNAL_DATA_DIR + "/")
        and "\\" not in path
        and not any(part in {"", ".", ".."} for part in path.split("/"))
        and not any(ord(char) < 32 or ord(char) == 127 for char in path)
    )


def source_file(root: Path, relative: str) -> Path:
    path = root / relative
    if path.resolve() != path or (path.exists() and not path.is_file()):
        raise ValueError(f"Invalid public Journal source path: {relative}")
    return path


def load_videos() -> dict[str, dict]:
    payload = json.loads(VIDEOS_JSON.read_text(encoding="utf-8"))
    videos = payload.get("videos") if isinstance(payload, dict) else None
    if not isinstance(videos, list) or not videos:
        raise ValueError("Video registry has no records")
    records = {}
    for video in videos:
        key = video.get("id") if isinstance(video, dict) else None
        if (
            not isinstance(key, str)
            or not VIDEO_RECORD_ID.fullmatch(key)
            or key in records
        ):
            raise ValueError(
                "Video registry contains a malformed or repeated record ID"
            )
        records[key] = video
    return records


def load_journal_index(root: Path) -> dict[str, dict]:
    data = json.loads(source_file(root, "INDEX.json").read_text(encoding="utf-8"))
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("Journal INDEX.json has no public items")
    videos: dict[str, dict] = {}
    for item in items:
        path = item.get("path") if isinstance(item, dict) else None
        parts = item.get("parts") if isinstance(item, dict) else None
        if not public_item_path(path) or not isinstance(parts, list):
            raise ValueError("Journal INDEX.json has an invalid public item")
        for video_id in parts:
            if not isinstance(video_id, str) or not YOUTUBE_ID.fullmatch(video_id):
                raise ValueError("Journal INDEX.json contains an invalid video ID")
            previous = videos.get(video_id)
            if previous is None or (
                previous.get("duplicate_of") and not item.get("duplicate_of")
            ):
                videos[video_id] = item
            elif previous["path"] != path and not (
                previous.get("duplicate_of") or item.get("duplicate_of")
            ):
                raise ValueError(
                    f"Multiple canonical Journal items for video {video_id}"
                )
    if not videos:
        raise ValueError("Journal INDEX.json contains no indexed video IDs")
    return videos


def sanitize_public_text(text: str) -> str:
    """Keep the existing public text projection used in video detail pages."""
    text = re.sub(r"\bcoda\b", "the platform", text, flags=re.IGNORECASE)
    text = text.replace("workspace", "work space")
    text = text.replace("Workspace", "Work space")
    text = re.sub(r"\bPDF\b", "document", text)
    text = re.sub(r"\bpdf\b", "document", text)
    text = re.sub(r"\bAII\.pdf\b", "document", text, flags=re.IGNORECASE)
    text = re.sub(r"\bSource Atlas\b", "source index", text)
    text = re.sub(r"\bSource Manifest\b", "source listing", text)
    text = re.sub(r"\bsource-page\b", "source reference", text)
    text = re.sub(r"\bpdf-pages\b", "document sections", text)
    text = re.sub(r"\batlas/\b", "index/", text)
    text = re.sub(r"\bPages\s+(\d)", r"sections \1", text)
    return text


def excerpt_from_transcript(text: str, max_chars: int = MAX_EXCERPT_CHARS) -> str:
    content = " ".join(
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.startswith("## ")
    )
    if len(content) > max_chars:
        content = content[:max_chars].rsplit(" ", 1)[0] + "…"
    return sanitize_public_text(content)


def project_record(
    video: dict, journal_root: Path, journal_index: dict[str, dict]
) -> dict:
    """Keep registry metadata and enrich it from the matched, indexed item."""
    youtube_url = video.get("youtubeUrl", "")
    youtube_id = extract_youtube_id(youtube_url)
    record = {
        "id": video["id"],
        "title": video.get("title", ""),
        "series": video.get("series", ""),
        "number": video.get("number", ""),
        "date": video.get("date", ""),
        "youtubeUrl": youtube_url,
        "youtubeId": youtube_id or "",
        "guests": [guest.get("name", "") for guest in video.get("guests", [])],
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
    item = journal_index.get(youtube_id)
    if item is None:
        return record

    item_path = item["path"]
    metadata_path = source_file(journal_root, f"{item_path}/metadata.json")
    if metadata_path.is_file():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict):
            raise ValueError(f"Invalid public Journal metadata: {item_path}")
        record["paperTitle"] = sanitize_public_text(metadata.get("paper_title") or "")
        record["githubUrl"] = record["githubUrl"] or metadata.get("github") or ""
        if metadata.get("sessions"):
            record["hasTimestamps"] = True
    if item.get("has_transcript") is True:
        relative = f"{item_path}/transcript.txt"
        transcript = source_file(journal_root, relative).read_text(encoding="utf-8")
        record["transcriptExcerpt"] = excerpt_from_transcript(transcript)
        record["hasTranscript"] = True
        record["transcriptSource"] = JOURNAL_BLOB_BASE + quote(relative)
    return record


def read_output() -> dict[str, Path]:
    if TRANSCRIPTS_OUT.resolve() != TRANSCRIPTS_OUT or (
        TRANSCRIPTS_OUT.exists() and not TRANSCRIPTS_OUT.is_dir()
    ):
        raise ValueError("The transcript record directory must be a regular directory")
    records = {}
    for entry in TRANSCRIPTS_OUT.glob("*.json"):
        if (
            entry.is_symlink()
            or not entry.is_file()
            or not VIDEO_RECORD_ID.fullmatch(entry.stem)
        ):
            raise ValueError(f"Unexpected transcript record: {entry.name}")
        records[entry.stem] = entry
    return records


def validate_record(record: dict, video: dict) -> bool:
    """Validate shipped records even when the upstream checkout is absent."""
    if any(
        record.get(key) != video.get(key, "")
        for key in ("id", "title", "series", "number", "date", "youtubeUrl")
    ):
        return False
    youtube_id = extract_youtube_id(video.get("youtubeUrl", ""))
    if youtube_id and record.get("youtubeId") != youtube_id:
        return False
    source = record.get("transcriptSource")
    excerpt = record.get("transcriptExcerpt")
    if not isinstance(source, str) or not isinstance(excerpt, str):
        return False
    if record.get("hasTranscript") is False:
        return not source and not excerpt
    if (
        not youtube_id
        or record.get("hasTranscript") is not True
        or not source.startswith(JOURNAL_BLOB_BASE)
    ):
        return False
    relative = unquote(source.removeprefix(JOURNAL_BLOB_BASE))
    item_path, _, filename = relative.rpartition("/")
    parsed = urlsplit(source)
    return (
        not parsed.query
        and not parsed.fragment
        and filename == "transcript.txt"
        and public_item_path(item_path)
    )


def check_transcripts(
    videos: dict[str, dict], projected: dict[str, dict] | None
) -> int:
    files = read_output()
    if not files and not TRANSCRIPTS_OUT.exists() and projected is None:
        print("No transcript records are present.")
        return 0
    actual = {
        key: json.loads(path.read_text(encoding="utf-8")) for key, path in files.items()
    }
    issues = set(videos) ^ set(actual)
    for key in set(videos) & set(actual):
        if not isinstance(actual[key], dict) or not validate_record(
            actual[key], videos[key]
        ):
            issues.add(key)
        elif projected is not None and actual[key] != projected[key]:
            issues.add(key)
    if issues:
        print(
            f"Invalid, missing, stale, or outdated transcript records: {len(issues)}",
            file=sys.stderr,
        )
        for key in sorted(issues)[:10]:
            print(f"  {key}", file=sys.stderr)
        return 1
    unsupported = sum(
        bool(video.get("youtubeUrl")) and not extract_youtube_id(video["youtubeUrl"])
        for video in videos.values()
    )
    if unsupported:
        print(f"Registry records with unsupported YouTube URLs: {unsupported}")
    print(f"Transcript record check passed for {len(actual)} videos.")
    return 0


def write_transcripts(records: dict[str, dict]) -> None:
    existing = read_output()
    TRANSCRIPTS_OUT.mkdir(parents=True, exist_ok=True)
    for key, record in records.items():
        content = json.dumps(record, indent=2, ensure_ascii=False) + "\n"
        path = TRANSCRIPTS_OUT / f"{key}.json"
        if key in existing and path.read_text(encoding="utf-8") == content:
            continue
        with NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=TRANSCRIPTS_OUT,
            prefix=".project-",
            delete=False,
        ) as stream:
            temp_path = Path(stream.name)
            try:
                stream.write(content)
                stream.flush()
                os.chmod(temp_path, 0o644)
                temp_path.replace(path)
            finally:
                temp_path.unlink(missing_ok=True)
    for key in set(existing) - set(records):
        existing[key].unlink()
    count = sum(record["hasTranscript"] for record in records.values())
    print(f"Projected {len(records)} public video records ({count} with transcripts).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--journal-root", type=Path, help="Select the ActiveInferenceJournal checkout"
    )
    parser.add_argument("--check", action="store_true", help="Validate without writing")
    args = parser.parse_args()
    journal_root = args.journal_root or os.environ.get("JOURNAL_ROOT")

    try:
        videos = load_videos()
        if args.check and not journal_root:
            return check_transcripts(videos, None)
        root = Path(
            journal_root or PROJECT_ROOT.parent / "ActiveInferenceJournal"
        ).resolve(strict=True)
        index = load_journal_index(root)
        projected = {
            key: project_record(video, root, index) for key, video in videos.items()
        }
        if args.check:
            return check_transcripts(videos, projected)
        write_transcripts(projected)
    except (OSError, ValueError) as error:
        print(f"Video transcript projection failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
