import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEvidenceDirectory, runSequential } from "./check_browser_suite.mjs";

test("successful steps execute in order and retain each exit status", () => {
  const cwd = mkdtempSync(join(tmpdir(), "browser-suite-order-"));
  const append = value => ["-e", `require('node:fs').appendFileSync('order',${JSON.stringify(value)})`];
  const result = runSequential([{ name: "first", argv: append("A") }, { name: "second", argv: append("B") }], cwd);
  assert.equal(readFileSync(join(cwd, "order"), "utf8"), "AB");
  assert.deepEqual(result, { exitCode: 0, results: [{ name: "first", exitCode: 0 }, { name: "second", exitCode: 0 }] });
});

test("a failed check stops the suite before a later command can run", () => {
  const cwd = mkdtempSync(join(tmpdir(), "browser-suite-failure-"));
  const result = runSequential([
    { name: "failed", argv: ["-e", "process.exit(7)"] },
    { name: "must-not-run", argv: ["-e", "throw Error('later command ran')"] },
  ], cwd);
  assert.deepEqual(result, { exitCode: 7, results: [{ name: "failed", exitCode: 7 }] });
});

test("signals and unavailable working directories cannot become successful checks", () => {
  const cwd = mkdtempSync(join(tmpdir(), "browser-suite-signal-"));
  assert.throws(() => runSequential([{ name: "signal", argv: ["-e", "process.kill(process.pid,'SIGTERM')"] }], cwd), /SIGTERM/);
  assert.throws(() => runSequential([{ name: "missing", argv: ["-e", "process.exit(0)"] }], join(cwd, "absent")), { code: "ENOENT" });
});

test("evidence runs are unique and cannot enter the public tree through symlinks", () => {
  const temp = mkdtempSync(join(tmpdir(), "browser-suite-evidence-"));
  const website = join(temp, "website"), evidence = join(temp, "evidence");
  mkdirSync(website);
  const first = createEvidenceDirectory(website, evidence), second = createEvidenceDirectory(website, evidence);
  assert.notEqual(first, second);
  assert.throws(() => createEvidenceDirectory(website, website), /outside/);
  symlinkSync(website, join(temp, "alias"));
  assert.throws(() => createEvidenceDirectory(website, join(temp, "alias")), /symlink/);
});
