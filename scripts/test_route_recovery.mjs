import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { normalizePublicUrl } from "../src/public-links.mjs";
import { setActiveLocale } from "../src/i18n/index.mjs";
import { redirectEntries } from "../src/redirects.mjs";
import { layout } from "../src/render/layout.mjs";

test("public URLs preserve explicit locales and shared asset paths, and bypass legacy aliases", () => {
  setActiveLocale("ru");
  try {
    for (const [input, expected] of [
      ["https://activeinference.institute/es/about/", "/es/about/"],
      ["https://activeinference.institute/simulations/Ink.html", "/simulations/Ink.html"],
      ["https://activeinference.institute/assets/img/icon-512.png", "/assets/img/icon-512.png"],
      ["https://www.activeinference.institute/donate?ref=test#giving", "/ru/programs/philanthropy/?ref=test#giving"],
      ["https://activeinference.institute/missing/", "/missing/"],
    ]) assert.equal(normalizePublicUrl(input), expected, input);
  } finally { setActiveLocale("en"); }
});

test("localized participation aliases have explicit, direct replacements", () => {
  const entries = redirectEntries();
  for (const [file, to] of [
    ["ru/internship/index.html", "ru/programs/internship/"],
    ["es/donate/index.html", "es/programs/philanthropy/"],
    ["hi/participation/index.html", "hi/get-involved/"],
    ["pt/simulations/Ink.html", "simulations/Ink.html"],
  ]) assert.ok(entries.some(entry => entry.file === file && entry.to === to), file);
});

test("untranslated archives declare the English body language within localized navigation", () => {
  setActiveLocale("ar");
  try {
    const html = layout({ title: "Archive", slug: "video-example", currentDir: "ar/video/example", body: "<h1>English archive</h1>" });
    assert.ok(html.includes('<html lang="ar" dir="rtl">'));
    assert.ok(html.includes('<div lang="en" dir="ltr"><h1>English archive</h1></div>'));
    assert.ok(html.includes('rel="canonical" href="https://activeinference.institute/video/example/"'));
    assert.ok(!html.includes('rel="alternate" hreflang='));
  } finally { setActiveLocale("en"); }
});

test("404 recovery uses known destinations only and preserves query and fragment", () => {
  const script = readFileSync(new URL("../assets/js/redirects.js", import.meta.url), "utf8");
  const run = (pathname) => {
    const replaced = [];
    vm.runInNewContext(script, {
      document: { currentScript: { dataset: { base: "/" } } },
      location: { pathname, search: "?ref=legacy", hash: "#details", replace: value => replaced.push(value) },
    });
    return replaced;
  };
  assert.deepEqual(run("/ru/active-inference-and-nonexistent/"), []);
  assert.deepEqual(run("/unrecognized/"), []);
  assert.deepEqual(run("/RU/ACTIVE-INFERENCE-AND-HEALTHCARE.html"), ["/ru/active-inference/healthcare/?ref=legacy#details"]);
  assert.deepEqual(run("/pt/simulations/Ink.html"), ["/simulations/Ink.html?ref=legacy#details"]);
});

test("sitemap does not present one data-export timestamp as every page's modification date", () => {
  const sitemap = readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8");
  assert.ok(!sitemap.includes("<lastmod>"), "Omit lastmod until per-page modification evidence is available");
});

test("translated newsletter collection advertises its locale alternates in the XML sitemap", () => {
  const sitemap = readFileSync(new URL("../sitemap.xml", import.meta.url), "utf8");
  const collection = sitemap.match(/<url><loc>https:\/\/activeinference\.institute\/newsletter\/<\/loc>[\s\S]*?<\/url>/)?.[0];
  assert.ok(collection?.includes('hreflang="es" href="https://activeinference.institute/es/newsletter/"'));
});
