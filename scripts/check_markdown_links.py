#!/usr/bin/env python3
"""Check tracked Markdown files for broken relative links.

Scans every git-tracked ``*.md`` file (including per-folder ``AGENTS.md``
guides; ``node_modules/`` is never tracked and is skipped defensively) for
inline Markdown links ``[text](target)`` and image references
``![alt](target)``. Relative targets must resolve to an existing file or
directory; failures are reported as ``file:line``. External ``http(s)``,
``mailto:`` and other scheme-carrying targets are skipped, as are pure
same-document ``#anchor`` links. Fragments on relative targets are ignored
(the existence of the target file is what is gated).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules"}
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel", "sms", "data", "javascript"}

# Inline link/image: [text](target) — target ends at the first ")".
# Targets containing balanced parentheses are almost always external URLs,
# which truncate at "(" but still carry their scheme and are skipped.
LINK_RE = re.compile(r"\[[^\]]*\]\(\s*([^()]*?)\s*\)")
# Optional markdown link title: [text](path "title")
TITLE_RE = re.compile(r'\s+("[^"]*"|\'[^\']*\')$')
CODE_SPAN_RE = re.compile(r"`[^`]*`")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def tracked_markdown_files(root: Path) -> list[Path]:
    """Return git-tracked *.md files; fall back to a filesystem walk."""
    try:
        completed = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z", "--", "*.md"],
            capture_output=True,
            text=True,
            check=True,
        )
        names = [name for name in completed.stdout.split("\0") if name]
        files = [root / name for name in names if (root / name).is_file()]
    except (OSError, subprocess.CalledProcessError):
        files = [
            path
            for path in root.rglob("*.md")
            if not any(part in SKIP_DIRS for part in path.relative_to(root).parts)
        ]
    return sorted(
        path for path in files
        if not any(part in SKIP_DIRS for part in path.relative_to(root).parts)
    )


def link_targets(text: str) -> list[tuple[int, str]]:
    """Yield (line_number, raw_target) for every inline Markdown link."""
    targets: list[tuple[int, str]] = []
    in_fence = False
    for line_number, line in enumerate(text.splitlines(), start=1):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        stripped = CODE_SPAN_RE.sub("", line)
        for match in LINK_RE.finditer(stripped):
            raw = TITLE_RE.sub("", match.group(1)).strip()
            if raw:
                targets.append((line_number, raw))
    return targets


def resolve_relative_target(source: Path, raw: str, root: Path) -> Path | None:
    """Resolve a Markdown link target to a filesystem path, or None to skip."""
    raw = raw.strip("<>")
    parsed = urlparse(raw)
    if parsed.scheme in EXTERNAL_SCHEMES or raw.startswith("//"):
        return None
    if not parsed.path:
        # Bare "#anchor" (same document) — the target file trivially exists.
        return None
    target_path = unquote(parsed.path)
    if target_path.startswith("/"):
        return (root / target_path.lstrip("/")).resolve()
    return (source.parent / target_path).resolve()


def check_markdown_links(root: Path) -> int:
    errors: list[str] = []
    markdown_files = tracked_markdown_files(root)
    checked = 0
    for markdown_file in markdown_files:
        text = markdown_file.read_text(encoding="utf-8")
        for line_number, raw in link_targets(text):
            target = resolve_relative_target(markdown_file, raw, root)
            if target is None:
                continue
            checked += 1
            try:
                target.relative_to(root)
            except ValueError:
                errors.append(
                    f"{markdown_file.relative_to(root)}:{line_number} link escapes project root: {raw}"
                )
                continue
            if not target.exists():
                errors.append(
                    f"{markdown_file.relative_to(root)}:{line_number} broken relative link {raw} -> "
                    f"{target.relative_to(root)}"
                )

    if errors:
        print("Broken Markdown links:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Checked {len(markdown_files)} Markdown files ({checked} relative links); no broken links."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=str(PROJECT_ROOT), help="Repository root")
    args = parser.parse_args()
    return check_markdown_links(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
