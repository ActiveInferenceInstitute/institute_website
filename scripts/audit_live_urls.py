#!/usr/bin/env python3
"""Bounded raw HTTP audit of public seeds, optional GSC CSV and live sitemap.

Does not authenticate, submit forms, mutate GSC, or retry failed requests.
Raw response bodies/headers remain in the explicitly selected output directory.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urljoin
from xml.etree import ElementTree as ET

from check_indexability import Page


def unexpected_status(status: int, exit_code: int, expected_status: int = 200) -> bool:
    return exit_code != 0 or status != expected_status


def probe(url: str, output: Path, timeout: int) -> dict:
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    headers = output / f"{key}.headers"
    body = output / f"{key}.body"
    command = [
        "curl",
        "--silent",
        "--show-error",
        "--location",
        "--max-redirs",
        "5",
        "--proto",
        "=http,https",
        "--proto-redir",
        "=http,https",
        "--connect-timeout",
        "8",
        "--max-time",
        str(timeout),
        "--max-filesize",
        "20000000",
        "--dump-header",
        str(headers),
        "--output",
        str(body),
        "--write-out",
        "%{json}",
        "--user-agent",
        "InstituteWebsiteAudit/1.0",
        url,
    ]
    started = datetime.now(UTC).isoformat()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 5, check=False)
        metadata = json.loads(completed.stdout) if completed.stdout.strip() else {}
        exit_code, error = completed.returncode, completed.stderr.strip()
    except subprocess.TimeoutExpired as exc:
        metadata, exit_code, error = {}, -1, str(exc)
    raw_headers = headers.read_text(encoding="utf-8", errors="replace") if headers.exists() else ""
    blocks = [block for block in raw_headers.replace("\r\n", "\n").split("\n\n") if block.startswith("HTTP/")]
    hops = []
    final_headers = {}
    for block in blocks:
        lines = block.splitlines()
        values = {}
        for line in lines[1:]:
            if ":" in line:
                name, value = line.split(":", 1)
                values.setdefault(name.lower(), []).append(value.strip())
        hops.append({"status": lines[0], "location": values.get("location", [])})
        final_headers = values
    page = Page()
    content_type = metadata.get("content_type") or ""
    if body.exists() and "html" in content_type:
        page.feed(body.read_text(encoding="utf-8", errors="replace"))
    effective = metadata.get("url_effective") or url
    refresh_targets = []
    for refresh in page.refresh:
        if ";" in refresh and "=" in refresh.split(";", 1)[1]:
            refresh_targets.append(urljoin(effective, refresh.split(";", 1)[1].split("=", 1)[1].strip()))
    record = {
        "URL": url,
        "observed_at": started,
        "curl_exit": exit_code,
        "error": error,
        "live status": metadata.get("http_code", 0),
        "redirect hops/final URL": effective,
        "http_hops": hops,
        "html_refresh": refresh_targets,
        "canonical": page.canonicals,
        "meta robots": page.robots,
        "X-Robots-Tag": final_headers.get("x-robots-tag", []),
        "HTTP canonical Link": final_headers.get("link", []),
        "hreflang": page.alternates,
        "locale": page.lang,
        "title": page.title,
        "html_redirect_stub": page.stub,
        "time_total_seconds": metadata.get("time_total"),
        "headers_file": headers.name,
        "body_file": body.name,
    }
    (output / f"{key}.json").write_text(json.dumps(record, indent=2) + "\n")
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--seeds", type=Path, default=Path(__file__).with_name("indexing_seeds.json"))
    parser.add_argument("--include-sitemap", action="store_true")
    parser.add_argument("--gsc-csv", type=Path)
    parser.add_argument("--gsc-reason")
    parser.add_argument("--report-date")
    parser.add_argument("--expected-count", type=int)
    parser.add_argument("--workers", type=int, default=6, choices=range(1, 17))
    parser.add_argument("--timeout", type=int, default=20, choices=range(1, 121))
    args = parser.parse_args()
    if args.gsc_csv and not (args.gsc_reason and args.report_date):
        parser.error("GSC CSV requires --gsc-reason and --report-date; preserve report context")
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=False)
    seeds = json.loads(args.seeds.read_text())
    sources = {row["URL"]: dict(row) for row in seeds["urls"]}
    exported_rows = []
    if args.gsc_csv:
        with args.gsc_csv.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                normalized = {k.lower().strip(): v for k, v in row.items()}
                url = normalized.get("url")
                if not url:
                    parser.error("GSC CSV must include a URL column")
                exported_rows.append(row)
                sources[url] = {
                    "URL": url,
                    "source": "GSC export",
                    "GSC reason": args.gsc_reason,
                    "last crawl": normalized.get("last crawled", normalized.get("last crawl", "unavailable")),
                    "report date": args.report_date,
                    "filter": "All known pages",
                }
    for url in [
        "https://activeinference.institute/",
        "https://activeinference.institute/sitemap.xml",
        "https://activeinference.institute/robots.txt",
    ]:
        sources.setdefault(url, {"URL": url, "source": "live audit control"})
    sitemap_url = "https://activeinference.institute/sitemap.xml"
    sitemap_receipt = probe(sitemap_url, output, args.timeout)
    if args.include_sitemap:
        if sitemap_receipt["curl_exit"] or sitemap_receipt["live status"] != 200:
            raise RuntimeError("live sitemap fetch failed; see raw receipt")
        tree = ET.parse(output / sitemap_receipt["body_file"]).getroot()
        namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        if tree.tag != namespace + "urlset":
            raise ValueError("Expected sitemap urlset; inspect sitemap indexes before enumerating")
        for element in tree.iter():
            url = element.text if element.tag == namespace + "loc" else element.get("href")
            if url:
                sources.setdefault(url.strip(), {"URL": url.strip(), "source": "live XML sitemap loc/alternate"})
    urls = [url for url in sources if url != sitemap_url]
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        records = list(executor.map(lambda url: {**sources[url], **probe(url, output, args.timeout)}, urls))
    records.append({**sources[sitemap_url], **sitemap_receipt})
    records.sort(key=lambda row: row["URL"])
    failures = [row for row in records if row["curl_exit"] or row["live status"] >= 400]
    unexpected = [
        row
        for row in records
        if unexpected_status(row["live status"], row["curl_exit"], row.get("expected status", 200))
    ]
    summary = {
        "observed_at": datetime.now(UTC).isoformat(),
        "seed_context": {k: v for k, v in seeds.items() if k != "urls"},
        "urls_probed": len(records),
        "http_errors": len(failures),
        "unexpected_results": len(unexpected),
        "html_redirect_stubs": sum(row["html_redirect_stub"] for row in records),
        "gsc_export_rows": len(exported_rows),
        "gsc_expected_count": args.expected_count,
        "gsc_example_shortfall": args.expected_count - len(exported_rows) if args.expected_count is not None else None,
        "filter": "All known pages" if args.gsc_csv else "no authenticated GSC export",
        "report_date": args.report_date,
        "failures": [{key: row.get(key) for key in ("URL", "live status", "curl_exit", "error")} for row in failures],
    }
    (output / "inventory.json").write_text(json.dumps(records, indent=2) + "\n")
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    with (output / "inventory.csv").open("w", newline="") as stream:
        fields = sorted({key for row in records for key in row})
        writer = csv.DictWriter(stream, fields)
        writer.writeheader()
        for row in records:
            writer.writerow(
                {key: json.dumps(value) if isinstance(value, (list, dict)) else value for key, value in row.items()}
            )
    print(json.dumps(summary, indent=2))
    return 1 if unexpected else 0


if __name__ == "__main__":
    raise SystemExit(main())
