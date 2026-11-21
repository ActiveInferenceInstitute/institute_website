"""Regression checks for public Journal-to-website transcript projection."""

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import sync_video_transcripts as sync


VIDEO_ID = "synthetic01"
ITEM = "data/video/activeinferenceinstitute/Public Series/Session #1"
ROW = {"path": ITEM, "parts": [VIDEO_ID], "has_transcript": True}
URL = f"https://www.youtube.com/watch?v={VIDEO_ID}"


class TranscriptProjectionTest(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name).resolve()
        self.journal = self.root / "journal"
        self.journal.mkdir()
        self.output = self.root / "records"
        self.video = {"id": "session-1", "title": "Public session", "youtubeUrl": URL}
        videos = self.root / "videos.json"
        videos.write_text(json.dumps({"videos": [self.video]}))
        self.enterContext(patch.object(sync, "VIDEOS_JSON", videos))
        self.enterContext(patch.object(sync, "TRANSCRIPTS_OUT", self.output))
        self.enterContext(patch.dict(sync.os.environ, clear=True))
        self.enterContext(redirect_stdout(StringIO()))
        self.enterContext(redirect_stderr(StringIO()))

    def set_index(self, *rows):
        (self.journal / "INDEX.json").write_text(json.dumps({"items": list(rows)}))

    def set_transcript(self, text):
        folder = self.journal / ITEM
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "transcript.txt").write_text(text)

    def run_projection(self, *options):
        with patch.object(sync.sys, "argv", ["sync_video_transcripts.py", *options]):
            return sync.main()

    def test_extracts_ids_only_from_supported_hosts_and_video_routes(self):
        for url in (
            URL,
            f"https://youtu.be/{VIDEO_ID}?t=4",
            f"https://m.youtube.com/shorts/{VIDEO_ID}",
            f"https://www.youtube.com/live/{VIDEO_ID}",
        ):
            with self.subTest(url=url):
                self.assertEqual(sync.extract_youtube_id(url), VIDEO_ID)
        for url in (
            f"https://youtube.com.example.test/watch?v={VIDEO_ID}",
            f"https://www.youtube.com/playlist?v={VIDEO_ID}",
            f"https://www.youtube.com/watch?v={VIDEO_ID}&v=anothervid1",
            "https://www.youtube.com/watch?v=short",
        ):
            with self.subTest(url=url):
                self.assertIsNone(sync.extract_youtube_id(url))

    def test_check_reports_explicit_source_drift_without_rewriting(self):
        self.set_index(ROW)
        self.set_transcript("## video id\nA source-backed example.")
        source_options = ("--journal-root", str(self.journal))
        self.assertEqual(self.run_projection(*source_options), 0)
        record = self.output / "session-1.json"
        before = record.read_bytes()
        self.assertIn(b"Public%20Series/Session%20%231/transcript.txt", before)
        self.assertEqual(self.run_projection("--check", *source_options), 0)
        self.set_transcript("A newer public transcript.")
        self.assertEqual(self.run_projection("--check", *source_options), 1)
        self.assertEqual(record.read_bytes(), before)
        self.assertEqual(self.run_projection("--check"), 0)

    def test_standalone_check_rejects_inconsistent_published_record(self):
        self.set_index(ROW)
        self.set_transcript("An example.")
        self.assertEqual(self.run_projection("--journal-root", str(self.journal)), 0)
        record_path = self.output / "session-1.json"
        record = json.loads(record_path.read_text())
        record["youtubeUrl"] = f"https://www.youtube.com/watch?v=anothervid1"
        record_path.write_text(json.dumps(record))
        self.assertEqual(self.run_projection("--check"), 1)

    def test_unsupported_video_urls_cannot_claim_transcript_provenance(self):
        self.set_index(ROW)
        invalid = {**self.video, "youtubeUrl": "https://youtu.be/unsupported1"}
        index = sync.load_journal_index(self.journal)
        record = sync.project_record(invalid, self.journal, index)
        self.assertTrue(sync.validate_record(record, invalid))
        record.update(
            hasTranscript=True,
            transcriptSource=sync.JOURNAL_BLOB_BASE + ITEM + "/transcript.txt",
        )
        self.assertFalse(sync.validate_record(record, invalid))

    def test_canonical_item_wins_and_non_indexed_files_are_excluded(self):
        alias = {
            "path": "data/video/activeinferenceinstitute/Other/Example",
            "parts": [VIDEO_ID],
            "has_transcript": False,
            "duplicate_of": "Public Series/Session #1",
        }
        self.set_transcript("Canonical transcript.")
        for rows in ((ROW, alias), (alias, ROW)):
            self.set_index(*rows)
            index = sync.load_journal_index(self.journal)
            self.assertEqual(index[VIDEO_ID], ROW)
            self.assertTrue(
                sync.project_record(self.video, self.journal, index)["hasTranscript"]
            )
        self.set_index({**ROW, "has_transcript": False})
        index = sync.load_journal_index(self.journal)
        self.assertFalse(
            sync.project_record(self.video, self.journal, index)["hasTranscript"]
        )

    def test_rejects_outside_journal_sources_before_any_writes(self):
        self.set_index(ROW)
        source = self.root / "unpublished.txt"
        source.write_text("Private example sentence.")
        folder = self.journal / ITEM
        folder.mkdir(parents=True)
        (folder / "transcript.txt").symlink_to(source)
        self.assertEqual(self.run_projection("--journal-root", str(self.journal)), 1)
        self.assertFalse(self.output.exists())
        self.set_index(
            {**ROW, "path": "data/video/activeinferenceinstitute/../../unpublished"}
        )
        self.assertEqual(self.run_projection("--journal-root", str(self.journal)), 1)
        self.assertFalse(self.output.exists())


class PublishedTranscriptRecordsTest(unittest.TestCase):
    def test_repository_records_have_consistent_provenance(self):
        if not sync.VIDEOS_JSON.is_file():
            self.skipTest(
                "Website fixture corpus is unavailable outside its source checkout"
            )
        self.assertEqual(sync.check_transcripts(sync.load_videos(), None), 0)
