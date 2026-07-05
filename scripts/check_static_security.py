#!/usr/bin/env python3
"""Validate the generated static site security contract."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = PROJECT_ROOT / "src" / "content"
# "simulations" holds vendored third-party interactive demos (self-contained
# canvas apps with inline scripts) mirrored from activeinference.org. They are
# intentionally exempt from the first-party CSP/no-inline-script contract; only
# generated, first-party pages are validated here.
EXCLUDED_PARTS = {".git", ".cache", "node_modules", "__pycache__", "src", "scripts", "simulations"}
DISALLOWED_TAGS = {"form", "iframe", "object", "embed"}
# Public, well-known destination hosts that may back an external anchor WITHOUT a
# per-URL live-sources.json entry. Used for data-driven links from public feeds
# (e.g. per-event YouTube/Zoom livestream links on the calendar) where the exact
# URL set is unbounded and cannot be hand-vetted. Anchors to these hosts still
# must carry target=_blank + rel="noopener noreferrer", and Coda is still banned.
VETTED_ANCHOR_HOST_SUFFIXES = (
    "youtube.com",
    "youtu.be",
    "activeinference.institute",
    "github.com",
    "zoom.us",
    "meet.google.com",
    "twitch.tv",
    "odysee.com",
)
ALLOWED_INSTITUTEOS_ASSETS = {"ActInferServe.png", "Dark_ActInfServe.png"}
# Same patterns used by scripts/sync_instituteos_public_data.py's PII gate,
# reused here against rendered *text* (not JSON string values) so both gates
# stay in lockstep. Generic email pattern; tight NANP phone grouping to avoid
# false positives on years, IDs, or coordinates.
EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}")
# Genuine public-by-design contact addresses, vetted by hand against their
# source content (never a raw leak): the Institute's general-inquiries address
# (src/content/site.json contact block, rendered site-wide in the footer/JSON-LD)
# and the Theoretical Neurobiology group's public mailing-list join address
# (src/content/pages/projects/project-theoretical-neurobiology.json). Add an
# entry here only after confirming the source is an intentional, public contact
# point — not a leaked private address.
VETTED_PUBLIC_EMAILS = {
    "blanket@activeinference.institute",
    "theoreticalneurobiology@gmail.com",
}
REQUIRED_CSP_DIRECTIVES = {
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "upgrade-insecure-requests",
}


class StaticHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.anchors: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.scripts: list[dict[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.tags: list[tuple[str, dict[str, str]]] = []
        self.inline_script_chunks: list[str] = []
        self.text_chunks: list[str] = []
        self._inside_script = False
        self._current_script_has_src = False
        # JSON-LD (``type="application/ld+json"``) is a non-executable structured-
        # data block, not script the CSP would run. It is the only standard way to
        # publish schema.org data, so its body is allowed (it never executes).
        self._current_script_is_data = False
        self._inside_style = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {name.lower(): value or "" for name, value in attrs}
        self.tags.append((tag.lower(), attrs_dict))
        if tag.lower() == "a":
            self.anchors.append(attrs_dict)
        elif tag.lower() == "link":
            self.links.append(attrs_dict)
        elif tag.lower() == "meta":
            self.metas.append(attrs_dict)
        elif tag.lower() == "script":
            self.scripts.append(attrs_dict)
            self._inside_script = True
            self._current_script_has_src = bool(attrs_dict.get("src"))
            self._current_script_is_data = attrs_dict.get("type", "").lower() == "application/ld+json"
        elif tag.lower() == "img":
            self.images.append(attrs_dict)
        elif tag.lower() == "style":
            self._inside_style = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script":
            self._inside_script = False
            self._current_script_has_src = False
            self._current_script_is_data = False
        elif tag.lower() == "style":
            self._inside_style = False

    def handle_data(self, data: str) -> None:
        if (
            self._inside_script
            and not self._current_script_has_src
            and not self._current_script_is_data
            and data.strip()
        ):
            self.inline_script_chunks.append(data.strip())
        # Rendered visible text only: skip script bodies (code/JSON-LD, not
        # prose) and style bodies (CSS, not prose) when collecting text to scan
        # for PII.
        if not self._inside_script and not self._inside_style and data.strip():
            self.text_chunks.append(data)


def parse_html(path: Path) -> StaticHtmlParser:
    parser = StaticHtmlParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def generated_html_files() -> list[Path]:
    return sorted(
        path
        for path in PROJECT_ROOT.rglob("*.html")
        if path.is_file() and not any(part in EXCLUDED_PARTS for part in path.relative_to(PROJECT_ROOT).parts)
    )


def external_url(value: str) -> bool:
    return urlparse(value).scheme in {"http", "https"}


def vetted_anchor_host(value: str) -> bool:
    """True when the URL's host is on the public vetted-host allowlist."""
    host = (urlparse(value).hostname or "").lower()
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in VETTED_ANCHOR_HOST_SUFFIXES)


def local_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "" and not value.startswith("//")


def _redact(value: str) -> str:
    """Fingerprint a matched PII value without printing it.

    CI logs are semi-public (visible to anyone with repo/CI access), so a real
    leak must never be echoed back verbatim by the checker that is supposed to
    catch it. A short, non-reversible fingerprint (length + hash prefix) is
    enough for a human to correlate a finding against the source file.
    """
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return f"<redacted, len={len(value)}, fingerprint={digest}>"


def find_pii(text: str) -> list[tuple[str, str]]:
    """Return (kind, matched-value) pairs for emails/phones not on the allowlist."""
    findings: list[tuple[str, str]] = []
    for email in EMAIL_RE.findall(text):
        if email.lower() not in {allowed.lower() for allowed in VETTED_PUBLIC_EMAILS}:
            findings.append(("email", email))
    for phone in PHONE_RE.findall(text):
        findings.append(("phone", phone))
    return findings


def live_urls() -> set[str]:
    manifest = json.loads((CONTENT_DIR / "live-sources.json").read_text(encoding="utf-8"))
    urls: set[str] = set()
    for source in manifest.get("sources", []):
        if not source.get("ok"):
            continue
        value = source.get("url")
        if value:
            clean = value.rstrip("/")
            urls.add(value)
            urls.add(clean)
            urls.add(f"{clean}/")
    return urls


def check_security() -> int:
    errors: list[str] = []
    allowed_live_urls = live_urls()
    html_files = generated_html_files()
    instituteos_asset_dir = PROJECT_ROOT / "assets" / "img" / "instituteos"
    if instituteos_asset_dir.exists():
        disk_assets = {path.name for path in instituteos_asset_dir.iterdir() if path.is_file()}
        if disk_assets != ALLOWED_INSTITUTEOS_ASSETS:
            errors.append(
                f"assets/img/instituteos must contain only brand assets {sorted(ALLOWED_INSTITUTEOS_ASSETS)}, found {sorted(disk_assets)}"
            )
    if not html_files:
        errors.append("no generated HTML files found")

    for html_path in html_files:
        relative = html_path.relative_to(PROJECT_ROOT)
        parser = parse_html(html_path)

        csp_values = [
            attrs.get("content", "")
            for attrs in parser.metas
            if attrs.get("http-equiv", "").lower() == "content-security-policy"
        ]
        if not csp_values:
            errors.append(f"{relative}: missing Content-Security-Policy meta tag")
        else:
            csp_parts = {part.strip() for part in csp_values[0].split(";") if part.strip()}
            missing = REQUIRED_CSP_DIRECTIVES - csp_parts
            if missing:
                errors.append(f"{relative}: CSP missing directives {sorted(missing)}")

        referrers = [attrs.get("content", "") for attrs in parser.metas if attrs.get("name", "").lower() == "referrer"]
        if "strict-origin-when-cross-origin" not in referrers:
            errors.append(f"{relative}: missing strict referrer policy")

        for tag, attrs in parser.tags:
            if tag in DISALLOWED_TAGS:
                errors.append(f"{relative}: disallowed <{tag}> tag")
            for name in attrs:
                if name.startswith("on"):
                    errors.append(f"{relative}: inline event handler attribute {name}")

        if parser.inline_script_chunks:
            errors.append(f"{relative}: inline script content is not allowed")
        for script in parser.scripts:
            src = script.get("src", "")
            if src and not local_url(src):
                errors.append(f"{relative}: external script is not allowed: {src}")

        for image in parser.images:
            src = image.get("src", "")
            if src and not local_url(src) and not src.startswith("data:"):
                errors.append(f"{relative}: external image is not allowed: {src}")
            if src.startswith("assets/img/instituteos/"):
                filename = Path(src).name
                if filename not in ALLOWED_INSTITUTEOS_ASSETS:
                    errors.append(f"{relative}: InstituteOS image is not an approved brand asset: {src}")
            if not image.get("alt"):
                errors.append(f"{relative}: image missing alt text: {src}")

        for link in parser.links:
            rel = link.get("rel", "").lower()
            href = link.get("href", "")
            if "stylesheet" in rel and href and not local_url(href):
                errors.append(f"{relative}: external stylesheet is not allowed: {href}")

        for anchor in parser.anchors:
            href = anchor.get("href", "")
            if href.startswith("mailto:") or href.startswith("#") or local_url(href):
                continue
            if not external_url(href):
                continue
            if "coda.io" in href.lower():
                errors.append(f"{relative}: direct Coda anchor is not allowed: {href}")
                continue
            backed = (
                href in allowed_live_urls
                or href.rstrip("/") in allowed_live_urls
                or vetted_anchor_host(href)
            )
            if not backed:
                errors.append(f"{relative}: external anchor is not backed by live-sources.json or a vetted host: {href}")
            if anchor.get("target") != "_blank":
                errors.append(f"{relative}: external anchor missing target=_blank: {href}")
            rel_tokens = set(anchor.get("rel", "").split())
            if not {"noopener", "noreferrer"}.issubset(rel_tokens):
                errors.append(f"{relative}: external anchor missing noopener noreferrer: {href}")

        # PII scan: rendered visible text (prose, not script/style bodies) plus
        # mailto: anchor targets, which can carry an address never printed in
        # the page's own text (e.g. a "Join the mailing list" link). Matches
        # against VETTED_PUBLIC_EMAILS are intentional public contacts and are
        # not reported; everything else is a contract violation. The matched
        # value itself is never printed — only a redacted fingerprint — so a
        # real finding cannot leak PII into CI logs via this checker.
        page_text = " ".join(parser.text_chunks)
        pii_findings = set(find_pii(page_text))
        vetted_lower = {allowed.lower() for allowed in VETTED_PUBLIC_EMAILS}
        for anchor in parser.anchors:
            href = anchor.get("href", "")
            if href.startswith("mailto:"):
                address = href[len("mailto:") :].split("?", 1)[0].strip()
                if address and address.lower() not in vetted_lower:
                    pii_findings.add(("email", address))
        for kind, value in sorted(pii_findings):
            errors.append(
                f"{relative}: possible {kind} address found in rendered output {_redact(value)} — "
                "vet the source content; if this is a genuine, intentional public contact point, "
                "add it to VETTED_PUBLIC_EMAILS, otherwise remove it"
            )

    if errors:
        print("Static security check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "Static security passed: CSP/referrer meta, local assets, safe external anchors, "
        "no disallowed tags, and no unvetted PII in rendered output."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(check_security())
