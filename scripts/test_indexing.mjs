import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { normalizePublicUrl, normalizePublicAnchors } from "../src/public-links.mjs";
import { validateRedirect } from "../src/redirects.mjs";
import { setActiveLocale, LOCALES, tr } from "../src/i18n/index.mjs";
import { layout } from "../src/render/layout.mjs";
import { icalStamp, calendarPage } from "../src/pages/calendar.mjs";
import { isVerifiedExternalUrl } from "../src/render/urls.mjs";

test("redirect guard rejects missing, stale and chained targets, and preserves real pages", () => {
  const root = mkdtempSync(join(tmpdir(), "website-redirect-control-"));
  mkdirSync(join(root, "current"));
  writeFileSync(join(root, "current/index.html"), "<h1>Current page</h1>");
  const entry = { file: "old/index.html", to: "current/" };
  const built = new Set(["current/index.html"]);
  assert.doesNotThrow(() => validateRedirect(entry, built, [entry], root));
  assert.throws(() => validateRedirect({ ...entry, to: "missing/" }, built, [], root), /Missing redirect destination/);
  assert.throws(() => validateRedirect(entry, new Set(), [], root), /Missing redirect destination/);
  assert.throws(() => validateRedirect(entry, built, [{ file: "current/index.html" }], root), /Redirect chain/);
  mkdirSync(join(root, "old"));
  writeFileSync(join(root, entry.file), "<h1>Preserve this page</h1>");
  assert.throws(() => validateRedirect(entry, built, [], root), /Refusing to overwrite/);
  assert.equal(readFileSync(join(root, entry.file), "utf8"), "<h1>Preserve this page</h1>");
});

test("public anchors remove dead links, normalize HTTPS, and keep on-site routes in the locale", () => {
  setActiveLocale("ru");
  assert.equal(normalizePublicUrl("https://mentorship.activeinference.institute/"), "/ru/programs/mentorship/");
  assert.equal(normalizePublicUrl("http://www.activeinference.institute/history"), "/ru/history/");
  assert.equal(normalizePublicUrl("http://newsletter.activeinference.institute/"), "https://newsletter.activeinference.institute/");
  assert.equal(normalizePublicUrl("http://bayeslanguage.org/"), "http://bayeslanguage.org/");
  assert.equal(normalizePublicUrl("http://adeelrazi.org/"), "https://adeelrazi.org/");
  assert.equal(isVerifiedExternalUrl("http://faculty.washington.edu/gmobus/"), true);
  assert.equal(isVerifiedExternalUrl("http://jakubsmekal.com/"), true);
  assert.equal(isVerifiedExternalUrl("https://www.activeinference.institute/"), true);
  assert.equal(normalizePublicAnchors('<a href="https://onboard.activeinference.org/x"><strong>Join</strong></a>'), "<strong>Join</strong>");
  assert.equal(normalizePublicAnchors('<a href="https://ecosystem.activeinference.institute/" target="_blank" rel="noopener noreferrer">Map</a>'), '<a href="/ru/ecosystem/">Map</a>');
  setActiveLocale("en");
});

test("verified profile hostname variants use HTTPS in renderer and Python policy", () => {
  const inputs = [
    "http://www.adeelrazi.org/research?q=1#bio",
    "http://sandeepramesh.com/research?q=1#bio",
    "http://www.alvaradolab.com/research?q=1#bio",
    "http://unverified.adeelrazi.org/",
    "http://bayeslanguage.org/",
  ];
  const expected = [
    "https://www.adeelrazi.org/research?q=1#bio",
    "https://sandeepramesh.com/research?q=1#bio",
    "https://www.alvaradolab.com/research?q=1#bio",
    "http://unverified.adeelrazi.org/",
    "http://bayeslanguage.org/",
  ];
  assert.deepEqual(inputs.map(normalizePublicUrl), expected);
  const python = spawnSync("python3", ["-c", "import json, sys; from scripts.public_link_policy import normalized_external_url; print(json.dumps([normalized_external_url(url) for url in json.load(sys.stdin)]))"], { input: JSON.stringify(inputs), encoding: "utf8" });
  assert.equal(python.status, 0, python.stdout + python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), expected);
  assert.equal(normalizePublicUrl("http://www.adeelrazi.org/"), "https://www.adeelrazi.org/");
  assert.equal(normalizePublicUrl("http://sandeepramesh.com/"), "https://www.sandeepramesh.com/");
  assert.equal(normalizePublicUrl("http://www.alvaradolab.com/"), "https://www.alvaradolab.com/");
});

test("retired RCSI profile resolves to the approved registered staff page", () => {
  const retired = "https://www.rcsi.com/people/profile/michaelthacker";
  const replacement = "https://www.rcsi.com/dublin/about/faculty-of-medicine-and-health-sciences/school-of-physiotherapy/our-people";
  assert.equal(normalizePublicUrl(retired), replacement);
  assert.equal(normalizePublicUrl("https://people.rcsi.com/michaelthacker"), replacement);
  assert.equal(isVerifiedExternalUrl(retired), true);
  assert.equal(normalizePublicUrl(replacement), replacement);
  assert.equal(normalizePublicUrl("https://www.rcsi.com/people/profile/someone-else"), "https://www.rcsi.com/people/profile/someone-else");
  assert.equal(normalizePublicAnchors(`<a href="${retired}">RCSI</a>`), `<a href="${replacement}">RCSI</a>`);
});

test("untranslated detail pages canonicalize to English; translated pages retain hreflang", () => {
  setActiveLocale("it");
  for (const [slug, dir, canonical] of [["newsletter/2023-march", "it/newsletter/2023-march", "newsletter/2023-march/"], ["video-example", "it/video/example", "video/example/"]]) {
    const html = layout({ title: "Example", slug, currentDir: dir, body: "<h1>Example</h1>" });
    assert.ok(html.includes(`rel="canonical" href="https://activeinference.institute/${canonical}"`));
    assert.ok(!html.includes('rel="alternate" hreflang='));
    assert.ok(html.includes("archived content remains in English"));
  }
  const translated = layout({ title: "Ecology", slug: "active-inference-and-ecology", currentDir: "it/active-inference/ecology", body: "<h1>Ecology</h1>" });
  assert.ok(translated.includes('rel="canonical" href="https://activeinference.institute/it/active-inference/ecology/"'));
  assert.ok(translated.includes('rel="alternate" hreflang="it"'));
  setActiveLocale("en");
});

test("link and domain gates fail on real negative-control files", () => {
  const run = spawnSync("python3", ["-m", "unittest", "scripts.test_indexing_controls"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test("ICS UTC stamps remain absolute when ICU returns bare GMT", () => {
  assert.equal(icalStamp("2026-10-12T16:00:00", false, { timeZone: "UTC" }), "20261012T160000Z");
  assert.equal(icalStamp("2026-10-12T16:00:00", false, { timeZone: "Etc/GMT" }), "20261012T160000Z");
  assert.equal(icalStamp("2026-10-12T16:00:00", false, { timeZone: "America/Los_Angeles" }), "20261012T230000Z");
  assert.equal(icalStamp("2026-10-12", true, {}), "20261012");
});

test("calendar count label is translated and shared by static markup and runtime in every locale", () => {
  try {
    for (const { code } of LOCALES) {
      setActiveLocale(code);
      const pattern = tr("Events shown: {n}");
      assert.equal((pattern.match(/\{n\}/g) || []).length, 1, code);
      if (code !== "en") assert.notEqual(pattern, "Events shown: {n}", code);
      const html = calendarPage();
      const count = html.match(/<p id="calendar-count"[^>]*data-msg-count-events="([^"]*)">([^<]*)<\/p>/);
      assert.ok(count, code);
      assert.ok(count[1].includes("{n}"), code);
      assert.ok(!count[2].includes("{n}"), code);
      assert.ok(count[2].startsWith(count[1].split("{n}")[0]), code);
      const options = [...html.matchAll(/<option value="(?:upcoming|past)">([^<]+)<\/option>/g)];
      assert.equal(options.length, 2, code);
      for (const option of options) {
        assert.ok(html.includes(`<h2>${option[1]}</h2>`), `${code}: heading matches translated filter`);
      }
    }
  } finally {
    setActiveLocale("en");
  }
});
