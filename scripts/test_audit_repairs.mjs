import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { layout } from "../src/render/layout.mjs";
import { videoDetailPage } from "../src/pages/video-detail.mjs";
import { homePage } from "../src/render/pages.mjs";

test("HTML alias preserves URL tails without racing a JS-enabled meta refresh", () => {
  const html = layout({ title: "Page moved", refreshPath: "/programs/internship/", body: "<p>Continue</p>" });
  assert.match(html, /<noscript>\s*<meta http-equiv="refresh"/);
  const scripts = [...html.matchAll(/<script\b([^>]*redirects\.js[^>]*)>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(scripts[0][1], /\bdefer\b/);
});

test("date-only and missing video dates cannot invent upload-time rich results", () => {
  for (const date of ["2026-01-01", "", undefined]) {
    const html = videoDetailPage({ id: "audit-date", title: "Archive session", date, guests: [], keywords: [], types: [], ontologyTerms: [] });
    assert.doesNotMatch(html, /"@type":"VideoObject"/);
    assert.doesNotMatch(html, /"uploadDate":"2021-01-01"/);
  }
});

test("fellowship primary action reaches the application instructions", () => {
  const page = JSON.parse(readFileSync(new URL("../src/content/pages/programs/fellowship.json", import.meta.url)));
  assert.equal(page.primaryActions[0].href, "#application-requirements");
});

test("homepage prioritizes visitor actions over private export mechanics", () => {
  const html = homePage();
  assert.doesNotMatch(html, /id="public-export-gate"|>Public export gate<|>Gate payloads</);
  assert.match(html, /programs\/internship\//);
  assert.match(html, /projects\/symposium\//);
});
