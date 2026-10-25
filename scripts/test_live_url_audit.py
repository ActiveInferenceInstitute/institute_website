"""Exercise curl/header collection against a real local HTTP server."""

import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from audit_live_urls import probe, unexpected_status


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path in {"/old", "/loop"}:
            self.send_response(301)
            self.send_header("Location", "/final" if self.path == "/old" else "/loop")
            self.end_headers()
            return
        self.send_response(404 if self.path == "/missing" else 200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("X-Robots-Tag", "noindex")
        self.end_headers()
        self.wfile.write(
            b'<html lang="en"><title>Example</title><link rel="canonical" href="/final"><h1>Example</h1></html>'
        )


class LiveAuditTests(unittest.TestCase):
    def test_expected_404_is_a_pass_but_transport_errors_and_unexpected_status_are_not(self):
        self.assertFalse(unexpected_status(404, 0, 404))
        self.assertFalse(unexpected_status(200, 0))
        self.assertTrue(unexpected_status(200, 6))
        self.assertTrue(unexpected_status(404, 0))
        self.assertTrue(unexpected_status(200, 0, 404))

    def test_raw_http_redirects_headers_errors_and_loop_are_retained(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            with tempfile.TemporaryDirectory(prefix="live-audit-control-") as directory:
                output = Path(directory)
                origin = f"http://127.0.0.1:{server.server_port}"
                redirected = probe(origin + "/old", output, 4)
                self.assertEqual(redirected["live status"], 200)
                self.assertEqual(redirected["curl_exit"], 0)
                self.assertEqual(len(redirected["http_hops"]), 2)
                self.assertEqual(redirected["redirect hops/final URL"], origin + "/final")
                self.assertEqual(redirected["X-Robots-Tag"], ["noindex"])
                self.assertTrue((output / redirected["body_file"]).is_file())
                missing = probe(origin + "/missing", output, 4)
                self.assertEqual(missing["live status"], 404)
                loop = probe(origin + "/loop", output, 4)
                self.assertEqual(loop["curl_exit"], 47)
                self.assertIn("redirect", loop["error"].lower())
                self.assertEqual(len(loop["http_hops"]), 6)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
