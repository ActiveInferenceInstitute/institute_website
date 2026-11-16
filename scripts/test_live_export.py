"""Exercise release identity and mismatches against a real loopback server."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
from threading import Thread
import unittest
from urllib.parse import unquote, urlsplit

from check_live_export import BOARD, MANIFEST_PATH, VERSION, expected_files, verify
from test_stage_public_assets import sample_exports, write_export


@contextmanager
def serve(files):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            route = unquote(urlsplit(self.path).path.lstrip("/"))
            if route not in files:
                self.send_error(404)
                return
            content = files[route]
            self.send_response(200)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *_args):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        thread = Thread(target=server.serve_forever)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}"
        finally:
            server.shutdown()
            thread.join(timeout=5)


class LiveExportTests(unittest.TestCase):
    def setUp(self):
        fixture = tempfile.TemporaryDirectory(prefix="website-live-export-")
        self.addCleanup(fixture.cleanup)
        self.root = Path(fixture.name)
        exports = sample_exports()
        fingerprint = write_export(self.root, exports)
        version = json.dumps({"source_fingerprint": fingerprint}).encode()
        board = b"<html>Board of Directors</html>"
        (self.root / VERSION).write_bytes(version)
        (self.root / BOARD).mkdir(parents=True)
        (self.root / BOARD / "index.html").write_bytes(board)
        self.candidate = {
            VERSION: version, MANIFEST_PATH: (self.root / MANIFEST_PATH).read_bytes(), BOARD: board,
            **{name: content for name, _, content in exports},
        }
        self.git("init", "--quiet")
        self.commit = self.record_commit()

    def git(self, *args):
        return subprocess.check_output(
            ("git", "-C", str(self.root), "-c", "user.name=Fixture", "-c",
             "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", *args),
            stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5,
        )

    def record_commit(self):
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Reviewed fixture")
        return self.git("rev-parse", "HEAD").decode().strip()

    def readback(self, responses):
        with serve(responses) as site:
            return verify(self.root, self.commit, 10, site=site)

    def test_exact_commit_passes_even_when_worktree_files_are_modified(self):
        (self.root / VERSION).write_text("dirty working copy")
        receipt = self.readback(self.candidate)
        self.assertEqual(receipt["status"], "verified")
        self.assertEqual(receipt["commit"], self.commit)
        self.assertEqual(set(receipt["expected"]), self.candidate.keys())

    def test_stale_version_and_missing_or_mismatched_payloads_are_reported(self):
        stale = self.readback({**self.candidate, VERSION: b"{}"})
        self.assertEqual(stale["status"], "unverified")
        self.assertEqual([item["path"] for item in stale["failures"]], [VERSION])

        mismatch = dict(self.candidate)
        del mismatch["data/projects.json"]
        mismatch[BOARD] = self.candidate[BOARD].replace(b"Board", b"Other")
        receipt = self.readback(mismatch)
        self.assertEqual(receipt["status"], "unverified")
        self.assertEqual(receipt["failures"], [
            {"path": "data/projects.json", "reason": "HTTP 404"},
            {"path": BOARD, "reason": "bytes differ from the reviewed commit"},
        ])

    def test_changed_git_payload_cannot_be_used_as_reference(self):
        (self.root / "data/projects.json").write_bytes(b"{}")
        with self.assertRaisesRegex(ValueError, "Committed bytes differ"):
            expected_files(self.root, self.record_commit())


if __name__ == "__main__":
    unittest.main()
