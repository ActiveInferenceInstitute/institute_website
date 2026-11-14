import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { projectCatalogFixture } from "./project_catalog_fixture.mjs";

// Capture real renderer requests in memory; never invoke the build or write extraction output.
process.env.I18N_EXTRACT = "1";
const { DEFAULT_LOCALE, NON_DEFAULT_LOCALES, extractedStrings, setActiveLocale } = await import("../src/i18n/index.mjs");
const { loadProjectsData } = await import("../src/data.mjs");
const { projectCatalogSection } = await import("../src/pages/projects.mjs");
const { homeInstituteosGate, instituteosFeatureSections } = await import("../src/render/feature-sections.mjs");
const { layout } = await import("../src/render/layout.mjs");
const { renderNarrativeBody } = await import("../src/render/narrative.mjs");
const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const extracted = readJson("../src/content/i18n/_strings.json");
const data = loadProjectsData();
const projects = data.projects;
try {
  setActiveLocale(DEFAULT_LOCALE);
  data.projects = projectCatalogFixture();
  const body = projectCatalogSection("projects") + homeInstituteosGate() + instituteosFeatureSections({ slug: "instituteos" }, "instituteos");
  layout({ title: "Projects", description: "", currentDir: "projects", slug: "projects", body });
} finally {
  data.projects = projects;
  setActiveLocale(DEFAULT_LOCALE);
}
const requiredKeys = new Set([...extracted, ...extractedStrings()]);
const placeholders = text => (text.match(/\{[A-Za-z]\w*\}/gu) || []).sort();
const paragraphs = text => text.trim().split(/\n\s*\n/u);
const listItems = text => (renderNarrativeBody(text).match(/<li>/gu) || []).length;

for (const { code } of NON_DEFAULT_LOCALES) {
  test(`${code}: every current extracted and rendered UI key has committed copy`, () => {
    const catalog = readJson(`../src/content/i18n/${code}.json`);
    for (const source of requiredKeys) {
      assert.equal(typeof catalog[source], "string", `${code}: absent key ${source}`);
      assert.ok(catalog[source].trim(), `${code}: empty key ${source}`);
    }
  });
  test(`${code}: all multiline passages and UI placeholders preserve source structure`, () => {
    const catalog = readJson(`../src/content/i18n/${code}.json`);
    for (const source of requiredKeys) {
      if (!source.includes("\n") && !source.includes("{")) continue;
      const translated = catalog[source];
      assert.equal(typeof translated, "string", `${code}: missing ${source}`);
      assert.equal(paragraphs(translated).length, paragraphs(source).length, `${code}: paragraph loss/duplication: ${source}`);
      assert.equal(listItems(translated), listItems(source), `${code}: rendered list item loss/duplication: ${source}`);
      assert.deepEqual(placeholders(translated), placeholders(source), `${code}: interpolation slots changed: ${source}`);
      assert.doesNotMatch(translated, /\{K\d+\}/u, `${code}: untranslated model mask: ${source}`);
      for (const contact of source.match(/\b[^\s@]+@[^\s@]+\.[^\s@.]+/gu) || []) {
        assert.ok(translated.includes(contact), `${code}: missing public contact ${contact}`);
      }
    }
  });
}
