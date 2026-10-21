import assert from "node:assert/strict";
import { test } from "node:test";
import { instituteosFeatureSections } from "../src/render/feature-sections.mjs";
import { normalizePublicAnchors } from "../src/public-links.mjs";
import { siteData } from "../src/data.mjs";

test("roster host labels identify their approved current destinations", () => {
  const html = normalizePublicAnchors(instituteosFeatureSections({ slug: "scientific-advisory-board" }));
  const links = [...html.matchAll(/<a class="roster-link" href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
  assert.ok(links.length > 0);
  for (const [, href, label] of links) {
    assert.equal(label, new URL(href, siteData.site.baseUrl).hostname.replace(/^www\./, ""), href);
  }
});
