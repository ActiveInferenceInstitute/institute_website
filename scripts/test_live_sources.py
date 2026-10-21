"""Local, real-HTTP regression tests for the live-source CLI (no external probes)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from check_live_sources import Source, probe_sources

CHECKER = Path(__file__).with_name("check_live_sources.py")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def do_GET(self):
        self.server.requests.append(self.path)
        path = urlsplit(self.path).path
        body = '<html><p id="present">Hello</p><a name="legacy"></a><p id="caf\u00e9 & tea">PRIVATE_PAYLOAD</p></html>'.encode()
        status, content_type = 200, "text/html; charset=utf-8"
        if path in {"/redirect", "/loop"}:
            status = 302
        elif path == "/pdf":
            content_type, body = "application/pdf", b"%PDF-1.7"
        elif path in {"/large", "/chunked"}:
            body += b"x" * (2 * 1024 * 1024)
        elif path.startswith("/status/"):
            status = int(path.rsplit("/", 1)[1])
        elif path == "/private-coda.io-token":
            status = 404
        elif path == "/dense":
            body = b"<b></b>" * 290000 + b'<i id="present"></i>'
        self.send_response(status)
        if path == "/redirect":
            self.send_header("Location", parse_qs(urlsplit(self.path).query)["to"][0])
        elif path == "/loop":
            self.send_header("Location", "/loop")
        self.send_header("Content-Type", content_type)
        if path == "/chunked":
            self.send_header("Transfer-Encoding", "chunked")
        else:
            self.send_header("Content-Length", str(len(body) + (100 if path == "/partial" else 0)))
        self.end_headers()
        if path == "/slow":
            self.server.release.wait(2.5)
        try:
            if path == "/chunked":
                self.wfile.write(f"{len(body):x}\r\n".encode() + body + b"\r\n0\r\n\r\n")
            else:
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return
        if path == "/partial":
            self.close_connection = True


class LiveSourcesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.requests = []
        cls.server.release = threading.Event()
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.release.set()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="live-source-test-")
        self.addCleanup(self.temp.cleanup)
        self.manifest = Path(self.temp.name) / "sources.json"

    def source(self, path="/", **fields):
        return {"id": "local", "url": self.base + path, "ok": True, "statusCode": 200, **fields}

    def run_cli(self, payload, *args, env=None):
        self.manifest.write_text(json.dumps(payload), encoding="utf-8")
        return self.invoke_cli(*args, env=env)

    def invoke_cli(self, *args, env=None):
        return subprocess.run(
            [sys.executable, str(CHECKER), str(self.manifest), *args],
            capture_output=True,
            text=True,
            timeout=10,
            env={**os.environ, "NO_PROXY": "*", "no_proxy": "*", **(env or {})},
        )

    def test_malformed_offline_record_fails_cleanly(self):
        # Given a malformed entry, when offline validation runs, then it fails without a traceback.
        result = self.run_cli({"sources": [None]}, "--offline")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("Traceback", result.stderr)

    def test_empty_sources_never_receive_fresh_evidence(self):
        payload = {"lastCheckedAt": "old", "sources": []}
        for args in (("--write",), ("--offline", "--write")):
            with self.subTest(args=args):
                result = self.run_cli(payload, *args)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertEqual(json.loads(self.manifest.read_text()), payload)

    def test_dense_html_parsing_stays_within_deadline(self):
        source = Source("dense", self.base + "/dense#present", True, 200, False)
        started = time.monotonic()
        result = probe_sources([source], timeout=0.15, workers=1, total_timeout=0.15)
        self.assertLess(time.monotonic() - started, 0.5)
        self.assertIn("deadline", result[0].error)

    def test_missing_fragment_fails(self):
        # Given a reachable page, when its absent anchor is checked, then HTTP 200 is insufficient.
        result = self.run_cli({"sources": [self.source("/#absent")]})
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_html_id_name_and_percent_decoded_fragments_pass(self):
        # Given HTML anchors, when ids/names and encoded Unicode are checked, then all resolve.
        for fragment in ("present", "legacy", "caf%C3%A9%20%26%20tea"):
            with self.subTest(fragment=fragment):
                result = self.run_cli({"sources": [self.source("/#" + fragment)]})
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_redirect_fragment_inheritance_replacement_and_clearing(self):
        # Given redirect Locations, when followed, then omitted fragments inherit and explicit ones replace.
        cases = {
            "/redirect?to=%2F#present": 0,
            "/redirect?to=%2F#absent": 1,
            "/redirect?to=%2F%23present#absent": 0,
            "/redirect?to=%2F%23absent#present": 1,
            "/redirect?to=%2F%23#absent": 0,
            "/redirect?to=%2F%23absent": 1,
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                result = self.run_cli({"sources": [self.source(path)]})
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)

    def test_http_404_is_preserved_in_report(self):
        # Given an expected-live 404, when checked, then it fails with the actual HTTP status.
        report = Path(self.temp.name) / "report.json"
        result = self.run_cli({"sources": [self.source("/status/404")]}, "--report", str(report))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(report.read_text())["sources"][0]["statusCode"], 404)

    def test_withheld_expected_404_is_verified(self):
        # Given a withheld 404 record, when its actual status agrees, then its expected state is verified.
        result = self.run_cli({"sources": [self.source("/status/404", ok=False, statusCode=404)]})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_redirect_loop_is_bounded(self):
        # Given a redirect loop, when checked, then redirect exhaustion fails after bounded requests.
        before = self.server.requests.count("/loop")
        result = self.run_cli({"sources": [self.source("/loop")]})
        self.assertEqual(result.returncode, 1)
        self.assertLessEqual(self.server.requests.count("/loop") - before, 11)

    def test_nonzero_curl_transfer_does_not_accept_partial_http_200(self):
        # Given a truncated real HTTP response, when curl exits nonzero, then its HTTP 200 cannot pass.
        report = Path(self.temp.name) / "report.json"
        result = self.run_cli({"sources": [self.source("/partial#present")]}, "--report", str(report))
        row = json.loads(report.read_text())["sources"][0]
        self.assertEqual(result.returncode, 1)
        self.assertEqual(row["statusCode"], 200)
        self.assertIn("exit 18", row["error"])

    def test_pdf_fragment_is_unverified(self):
        # Given a PDF, when a PDF fragment is requested, then no HTML-anchor verification is claimed.
        result = self.run_cli({"sources": [self.source("/pdf#page=1")]})
        self.assertEqual(result.returncode, 1)
        self.assertIn("not HTML", result.stderr)

    def test_fragment_body_limit_fails_and_cleans_downloads(self):
        # Given oversized HTML, when fragment probing runs, then it fails and removes its temporary bodies.
        directory = Path(self.temp.name) / "downloads"
        directory.mkdir()
        result = self.run_cli(
            {"sources": [self.source("/large#present")]}, env={**os.environ, "TMPDIR": str(directory)}
        )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(list(directory.iterdir()), [])

    def test_total_deadline_does_not_wait_for_queued_sources(self):
        # Given many stalled URLs, when the batch budget expires, then only running workers were submitted.
        sources = [self.source("/slow", id=f"source-{index}") for index in range(20)]
        report = Path(self.temp.name) / "report.json"
        before = self.server.requests.count("/slow")
        started = time.monotonic()
        result = self.run_cli(
            {"sources": sources}, "--workers", "2", "--timeout", "5", "--total-timeout", "0.3", "--report", str(report)
        )
        self.assertEqual(result.returncode, 1)
        self.assertLess(time.monotonic() - started, 1.5)
        self.assertLessEqual(self.server.requests.count("/slow") - before, 2)
        self.assertEqual(json.loads(report.read_text())["counts"]["error"], 20)

    def test_offline_never_networks_or_writes_freshness(self):
        # Given valid local URLs, when offline --write runs, then neither requests nor evidence change.
        payload = {"lastCheckedAt": "old", "sources": [self.source("/offline-probe", checkedAt="old")]}
        before = len(self.server.requests)
        result = self.run_cli(payload, "--offline", "--write")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.server.requests), before)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)

    def test_malformed_manifests_fail_without_network_or_mutation(self):
        # Given malformed boundary values, when offline --write runs, then each fails cleanly unchanged.
        invalid = [
            None,
            [],
            {},
            {"sources": None},
            {"sources": {}},
            {"sources": [False]},
            {"sources": [self.source(), self.source()]},
            {"sources": [{"id": "x", "url": self.base}]},
        ]
        fields = [
            {"id": ""},
            {"id": None},
            {"id": "bad\n"},
            {"url": None},
            {"ok": "true"},
            {"knownBotBlocked": 1},
            {"statusCode": True},
            {"statusCode": "200"},
            {"statusCode": 200.0},
            {"statusCode": -1},
            {"statusCode": 600},
            {"finalUrl": "https://coda.io/private-secret"},
        ]
        invalid.extend({"sources": [self.source(**field)]} for field in fields)
        before = len(self.server.requests)
        for payload in invalid:
            with self.subTest(payload=payload):
                result = self.run_cli(payload, "--offline", "--write")
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("Traceback", result.stderr)
                self.assertNotIn("private-secret", result.stderr)
                self.assertEqual(json.loads(self.manifest.read_text()), payload)
        self.assertEqual(len(self.server.requests), before)

    def test_invalid_urls_fail_offline(self):
        # Given unsafe or malformed URLs, when parsed offline, then none reach the network boundary.
        urls = [
            "file:///tmp/private",
            "/relative",
            "javascript:alert(1)",
            "https://",
            "http:///x",
            "http://user:secret@localhost/",
            "http://localhost:bad/",
            "http://localhost:0/",
            "http://localhost:65536/",
            "http://[::1",
            "http://bad_host/",
            "http://host/a\n",
            "http://host/%0Asecret",
            "http://host/%ZZ",
            "http://host/\\secret",
            "https://coda.io/x",
            "https://sub.coda.io./x",
            "HTTPS://CODA.IO/x",
        ]
        for url in urls:
            with self.subTest(url=url):
                result = self.run_cli({"sources": [self.source(url=url)]}, "--offline")
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("Traceback", result.stderr)

    def test_invalid_cli_budgets_fail_cleanly(self):
        # Given invalid budgets, when parsed by the CLI, then execution fails without a traceback.
        for option, value in (
            ("--timeout", "0"),
            ("--timeout", "nan"),
            ("--timeout", "inf"),
            ("--total-timeout", "-1"),
            ("--workers", "0"),
            ("--workers", "33"),
        ):
            with self.subTest(option=option, value=value):
                result = self.run_cli({"sources": [self.source()]}, option, value)
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("Traceback", result.stderr)

    def test_verification_failure_prevents_all_manifest_writes(self):
        # Given one success and one missing anchor, when --write runs, then all original evidence remains.
        payload = {
            "lastCheckedAt": "old",
            "sources": [self.source(id="good", checkedAt="old"), self.source("/#missing", checkedAt="old")],
        }
        result = self.run_cli(payload, "--write")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)

    def test_plausible_bot_responses_remain_unverified_without_refresh(self):
        # Given registered bot restrictions, when plausible statuses recur, then timestamps remain old.
        report = Path(self.temp.name) / "report.json"
        sources = [
            self.source(f"/status/{status}", id=f"bot-{status}", knownBotBlocked=True, checkedAt="old")
            for status in (403, 429, 999)
        ]
        payload = {"lastCheckedAt": "old", "sources": sources}
        result = self.run_cli(payload, "--write", "--report", str(report))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)
        self.assertEqual(json.loads(report.read_text())["counts"]["unverified"], 3)

    def test_bot_flag_never_exempts_404_5xx_missing_anchor_or_timeout(self):
        # Given a bot flag, when real verification errors occur, then the flag cannot waive them.
        for path in ("/status/401", "/status/404", "/status/500", "/#missing", "/partial#present", "/slow"):
            with self.subTest(path=path):
                result = self.run_cli({"sources": [self.source(path, knownBotBlocked=True)]}, "--timeout", "0.2")
                self.assertEqual(result.returncode, 1, result.stdout)

    def test_successful_bot_probe_does_not_refresh_bot_evidence(self):
        # Given a bot-marked URL returning 200, when --write runs, then its manual timestamp is preserved.
        source = self.source(knownBotBlocked=True, checkedAt="old")
        result = self.run_cli({"sources": [source]}, "--write")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.manifest.read_text())["sources"][0], source)

    def test_report_and_console_redact_redirect_destinations_and_body(self):
        # Given a redirect to a private-looking path, when verification fails, then only registered URLs escape.
        report = Path(self.temp.name) / "report.json"
        source = self.source("/redirect?to=%2Fprivate-coda.io-token")
        result = self.run_cli({"sources": [source]}, "--report", str(report))
        output = result.stdout + result.stderr + report.read_text()
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(self.base + "/private-coda.io-token", output)
        self.assertNotIn("PRIVATE_PAYLOAD", output)
        self.assertNotIn("finalUrl", output)
        self.assertEqual(json.loads(report.read_text())["sources"][0]["url"], source["url"])

    def test_successful_write_refreshes_verified_evidence(self):
        # Given a verified source, when --write runs, then its evidence timestamp and global freshness update.
        result = self.run_cli({"lastCheckedAt": "old", "sources": [self.source(checkedAt="old")]}, "--write")
        data = json.loads(self.manifest.read_text())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotEqual(data["lastCheckedAt"], "old")
        self.assertEqual(data["sources"][0]["checkedAt"], data["lastCheckedAt"])

    def test_report_cannot_overwrite_manifest(self):
        # Given the manifest as report target, when requested, then input evidence is preserved.
        payload = {"sources": [self.source()]}
        result = self.run_cli(payload, "--report", str(self.manifest))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)

    def test_tls_failure_is_status_zero_incomplete(self):
        # Given HTTPS to a real plain-HTTP socket, when TLS fails, then it cannot become verified reachability.
        report = Path(self.temp.name) / "report.json"
        source = self.source(url=self.base.replace("http:", "https:"), knownBotBlocked=True, ok=False, statusCode=0)
        result = self.run_cli({"sources": [source]}, "--timeout", "0.3", "--report", str(report))
        row = json.loads(report.read_text())["sources"][0]
        self.assertEqual(result.returncode, 1)
        self.assertEqual(row["statusCode"], 0)
        self.assertEqual(row["result"], "error")

    def test_chunked_fragment_download_is_bounded(self):
        # Given oversized chunked HTML without Content-Length, when probed, then curl's body cap still fails.
        result = self.run_cli({"sources": [self.source("/chunked#present")]})
        self.assertEqual(result.returncode, 1, result.stdout)

    def test_invalid_json_and_unreadable_manifest_fail_cleanly(self):
        # Given invalid JSON bytes, when the CLI loads them, then it fails cleanly without replacing evidence.
        for content in (b'{"sources": [', b"\xff", b"[]"):
            with self.subTest(content=content):
                self.manifest.write_bytes(content)
                result = self.invoke_cli("--offline", "--write")
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("Traceback", result.stderr)
                self.assertEqual(self.manifest.read_bytes(), content)

    def test_missing_manifest_fails_cleanly(self):
        # Given a nonexistent manifest, when loaded, then a clean failure replaces a filesystem traceback.
        result = self.invoke_cli("--offline")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("Traceback", result.stderr)

    def test_offline_succeeds_without_curl_installed(self):
        # Given no executable search path, when offline validation runs, then curl is never needed.
        result = self.run_cli({"sources": [self.source()]}, "--offline", env={**os.environ, "PATH": ""})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_curl_fails_online_without_refresh(self):
        # Given no curl executable, when online --write runs, then the manifest is preserved and check fails.
        payload = {"sources": [self.source(checkedAt="old")]}
        result = self.run_cli(payload, "--write", env={**os.environ, "PATH": ""})
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("Traceback", result.stderr)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)

    def test_unsafe_redirect_never_opens_local_file_or_credential_url(self):
        # Given unsafe redirect references, when checked, then the destination fails before a second probe.
        for target in ("file%3A%2F%2F%2Fetc%2Fpasswd", "http%3A%2F%2Fuser%3Asecret%40localhost%2F"):
            with self.subTest(target=target):
                report = Path(self.temp.name) / "report.json"
                result = self.run_cli({"sources": [self.source("/redirect?to=" + target)]}, "--report", str(report))
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("file:///etc/passwd", result.stdout + result.stderr + report.read_text())

    def test_report_alias_cannot_overwrite_manifest(self):
        # Given a hardlink alias as report output, when requested, then original evidence remains untouched.
        payload = {"sources": [self.source()]}
        self.manifest.write_text(json.dumps(payload), encoding="utf-8")
        alias = Path(self.temp.name) / "alias.json"
        alias.hardlink_to(self.manifest)
        result = self.invoke_cli("--report", str(alias))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(self.manifest.read_text()), payload)


if __name__ == "__main__":
    unittest.main()
