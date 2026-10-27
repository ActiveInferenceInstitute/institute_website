import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { websiteSourceFingerprint } from "../src/build-identity.mjs";

test("website identity follows source bytes and stays independent of build output and checkout path", () => {
  const make = () => {
    const root = mkdtempSync(join(tmpdir(), "website-identity-"));
    mkdirSync(join(root, "src")); mkdirSync(join(root, "assets/js"), { recursive: true }); mkdirSync(join(root, "simulations"));
    writeFileSync(join(root, "src/page.mjs"), "public source"); writeFileSync(join(root, "package.json"), "{}");
    return root;
  };
  const one = make(), two = make(); const before = websiteSourceFingerprint(one);
  assert.equal(before, websiteSourceFingerprint(two));
  writeFileSync(join(one, "version.json"), "generated output");
  writeFileSync(join(one, "assets/js/search-data.js"), "generated index");
  assert.equal(before, websiteSourceFingerprint(one));
  writeFileSync(join(one, "src/page.mjs"), "changed public source");
  assert.notEqual(before, websiteSourceFingerprint(one));
});

test("independent Python identity agrees for Unicode paths as well as ordinary source", () => {
  const root = mkdtempSync(join(tmpdir(), "website-unicode-"));
  mkdirSync(join(root, "src")); mkdirSync(join(root, "assets")); mkdirSync(join(root, "simulations"));
  writeFileSync(join(root, "package.json"), "{}");
  for (const name of ["\uE000.mjs", "\u{10000}.mjs", "é.mjs"]) writeFileSync(join(root, "src", name), name);
  const script = "import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from source_identity import website_source_fingerprint;print(website_source_fingerprint(Path(sys.argv[2])))";
  const actual = execFileSync("python3", ["-c", script, new URL("./", import.meta.url).pathname, root], { encoding: "utf8" }).trim();
  assert.equal(actual, websiteSourceFingerprint(root));
});

// Vendored demos are authored inputs; the generated catalog is not.
test("identity includes simulation source and excludes its generated catalog", () => {
  const root = mkdtempSync(join(tmpdir(), "website-demo-"));
  for(const dir of ["src","assets","simulations"])mkdirSync(join(root,dir));
  writeFileSync(join(root,"package.json"),"{}");
  writeFileSync(join(root,"simulations/Ink.html"),"original demo");
  const before=websiteSourceFingerprint(root);
  writeFileSync(join(root,"simulations/index.html"),"generated catalog");
  assert.equal(websiteSourceFingerprint(root),before);
  writeFileSync(join(root,"simulations/Ink.html"),"updated demo");
  assert.notEqual(websiteSourceFingerprint(root),before);
});
