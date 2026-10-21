import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t, layout = "repos/public/website", withSource = true) {
  const work = mkdtempSync(resolve(tmpdir(), "design-system-discovery-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const consumer = resolve(work, "consumer");
  const website = resolve(consumer, layout);
  const source = resolve(consumer, "library/design-system");
  mkdirSync(resolve(website, "scripts"), { recursive: true });
  mkdirSync(resolve(website, "assets/css"), { recursive: true });
  cpSync(resolve(root, "scripts/check_design_system_export.mjs"), resolve(website, "scripts/check_design_system_export.mjs"));
  cpSync(resolve(root, "assets/css/styles.css"), resolve(website, "assets/css/styles.css"));
  cpSync(resolve(root, "assets/css/fonts"), resolve(website, "assets/css/fonts"), { recursive: true });
  const css = readFileSync(resolve(root, "assets/css/instituteos-ds.css"), "utf8");
  writeFileSync(resolve(website, "assets/css/instituteos-ds.css"), css + "\n\n\n");
  if (withSource) {
    mkdirSync(resolve(source, "src/styles"), { recursive: true });
    writeFileSync(resolve(source, "src/styles/brand-fonts.css"), css.slice(css.indexOf("*/") + 4));
    for (const name of ["tokens", "primitives", "components"]) {
      writeFileSync(resolve(source, `src/styles/${name}.css`), "");
    }
    cpSync(resolve(root, "assets/css/fonts"), resolve(source, "src/styles/fonts"), { recursive: true });
  }
  const run = (override) => {
    const env = { ...process.env };
    delete env.INSTITUTEOS_DS_ROOT;
    if (override !== undefined) env.INSTITUTEOS_DS_ROOT = override;
    return spawnSync(process.execPath, [resolve(website, "scripts/check_design_system_export.mjs")], {
      cwd: work,
      env,
      encoding: "utf8",
      timeout: 10000,
    });
  };
  return { work, website, source, run };
}

for (const layout of ["repos/website", "repos/public/website", "checkouts/deeply/nested/website"]) {
  test(`source freshness is checked in ${layout}`, (t) => {
    const f = fixture(t, layout);
    const result = f.run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /PASS: website design-system export matches/);
    assert.doesNotMatch(result.stdout, /skipping export/);
  });
}

test("nested checkout rejects stale exported CSS", (t) => {
  const f = fixture(t);
  writeFileSync(resolve(f.website, "assets/css/instituteos-ds.css"), "stale export");
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Website design-system CSS is stale/);
});

test("nested checkout rejects stale exported fonts", (t) => {
  const f = fixture(t);
  writeFileSync(resolve(f.source, "src/styles/fonts/control.woff2"), "synthetic font");
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /font list differs/);
});

test("explicit source takes precedence over ancestor discovery", (t) => {
  const f = fixture(t);
  const explicit = resolve(f.work, "explicit-source");
  cpSync(f.source, explicit, { recursive: true });
  writeFileSync(resolve(f.source, "src/styles/tokens.css"), "stale source");
  const result = f.run(explicit);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS: website design-system export matches/);
});

test("missing explicit source fails even when an ancestor source exists", (t) => {
  const f = fixture(t);
  const result = f.run(resolve(f.work, "missing-source"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /INSTITUTEOS_DS_ROOT/);
  assert.doesNotMatch(result.stdout, /skipping export/);
});

test("explicit source must be a directory", (t) => {
  const f = fixture(t);
  const file = resolve(f.work, "source-file");
  writeFileSync(file, "not a directory");
  const result = f.run(file);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /INSTITUTEOS_DS_ROOT/);
  assert.doesNotMatch(result.stdout, /skipping export/);
});

test("standalone checkout retains the committed-token fallback check", (t) => {
  const f = fixture(t, "website", false);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /skipping export/);
  assert.match(result.stdout, /fallbacks match canonical tokens/);
});
