import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadProjectsData, EXPORT_PROVENANCE } from "../src/data.mjs";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES, formatNumber, setActiveLocale, tr } from "../src/i18n/index.mjs";
import { escapeHtml } from "../src/lib/text.mjs";
import { projectCatalogSection } from "../src/pages/projects.mjs";
import { homeInstituteosGate, instituteosFeatureSections } from "../src/render/feature-sections.mjs";
import { projectCatalogFixture } from "./project_catalog_fixture.mjs";

const data = loadProjectsData();
const originalProjects = data.projects;
const originalManifest = { ...EXPORT_PROVENANCE };
beforeEach(() => {
  data.projects = projectCatalogFixture();
  setActiveLocale(DEFAULT_LOCALE);
});
afterEach(() => {
  data.projects = originalProjects;
  for (const key of Object.keys(EXPORT_PROVENANCE)) delete EXPORT_PROVENANCE[key];
  Object.assign(EXPORT_PROVENANCE, originalManifest);
  setActiveLocale(DEFAULT_LOCALE);
});

function containsText(html, source) {
  const translated = tr(source);
  assert.notEqual(translated, source, `Missing Spanish UI translation: ${source}`);
  assert.ok(html.includes(escapeHtml(translated)), source);
}

test("Spanish catalog translates static labels, accessible names, captions and empty states", () => {
  setActiveLocale("es");
  const html = projectCatalogSection("es/projects");
  for (const source of [
    "Institute-hosted projects", "Ecosystem projects", "Full catalog", "Browse every public project",
    "Project", "About", "Topics", "Lead & people", "All topics", "Active projects", "Archived & completed projects",
    "Search institute-hosted projects", "Search ecosystem projects",
    "Filter institute-hosted projects by topic", "Filter ecosystem projects by topic",
    "Active Institute-hosted projects, from the public InstituteOS project registry.",
    "Archived and completed Institute-hosted projects, from the public InstituteOS project registry.",
    "Active Ecosystem projects, from the public InstituteOS project registry.",
    "Archived and completed Ecosystem projects, from the public InstituteOS project registry.",
    "No active institute-hosted projects match your search.",
    "No archived or completed institute-hosted projects match your search.",
    "No active ecosystem projects match your search.",
    "No archived or completed ecosystem projects match your search.",
  ]) containsText(html, source);
  for (const group of ["institute-hosted", "ecosystem"]) {
    const placeholder = tr(`Search {n} ${group} projects by name, topic, or lead…`).replace("{n}", "3");
    assert.ok(html.includes(`placeholder="${escapeHtml(placeholder)}"`));
  }
  for (const n of [1, 2, 3]) {
    assert.ok(html.includes(escapeHtml(tr("{n} projects").replace("{n}", String(n)))));
  }
  assert.ok(html.includes(escapeHtml(tr("{n} public projects with a page on this site").replace("{n}", "6"))));
  assert.ok(html.includes(`data-msg-count-projects="${escapeHtml(tr("{n} projects"))}"`));
  assert.ok(html.includes(`data-msg-count-projects-shown="${escapeHtml(tr("{n} projects shown"))}"`));
});

test("locale rendering preserves affiliation, status, topic identities and public names", () => {
  setActiveLocale("es");
  const html = projectCatalogSection("es/projects");
  for (const project of data.projects) {
    assert.ok(html.includes(`data-affiliation="${project.affiliation}" data-status="${project.status}"`));
    assert.ok(html.includes(`data-topics="${project.topics.join(" ")}"`));
    assert.ok(html.includes(`href="${project.id}/">${project.title}</a>`));
  }
  const institute = html.split('id="catalog-institute"')[1].split('id="catalog-ecosystem"')[0];
  const ecosystem = html.split('id="catalog-ecosystem"')[1];
  assert.ok(institute.includes('value="institute-only"'));
  assert.ok(!institute.includes('value="ecosystem-only"'));
  assert.ok(ecosystem.includes('value="ecosystem-only"'));
  assert.ok(!ecosystem.includes('value="institute-only"'));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; evidence"));
});

test("zero and single-project inputs do not invent empty affiliations or archived tables", () => {
  data.projects = [];
  assert.equal(projectCatalogSection(), "");
  data.projects = [projectCatalogFixture()[0]];
  setActiveLocale("es");
  const html = projectCatalogSection("es/projects");
  assert.ok(html.includes('id="catalog-institute-active-table"'));
  assert.ok(!html.includes('id="catalog-institute-archived-table"'));
  assert.ok(!html.includes('id="catalog-ecosystem"'));
  assert.ok(html.includes(escapeHtml(tr("{n} projects").replace("{n}", "1"))));
});

test("initial large counts use every configured locale's numeric formatting", () => {
  const project = projectCatalogFixture()[0];
  data.projects = Array.from({ length: 1234 }, (_, i) => ({ ...project, id: `project-${i}`, website_slug: `project-item-${i}` }));
  for (const { code } of NON_DEFAULT_LOCALES) {
    setActiveLocale(code);
    const expected = new Intl.NumberFormat(code).format(1234);
    assert.equal(formatNumber(1234), expected);
    assert.ok(projectCatalogSection(`${code}/projects`).includes(escapeHtml(tr("{n} projects").replace("{n}", expected))));
  }
});

test("localized export metrics retain exact provenance values and escape interpolation", () => {
  EXPORT_PROVENANCE.files = [{ name: "fixture.json", record_count: 12345, output_path: "data/fixture.json", sha256: "a".repeat(64) }];
  EXPORT_PROVENANCE.gate_version = '<img src=x onerror="alert(1)">';
  EXPORT_PROVENANCE.source_fingerprint = "f".repeat(64);
  EXPORT_PROVENANCE.generated_at = "2026-11-13T12:00:00Z";
  setActiveLocale("es");
  const home = homeInstituteosGate("es");
  const page = instituteosFeatureSections({ slug: "instituteos" }, "es/instituteos");
  for (const key of ["public export artifacts", "Open Source Map rows", "gate version",
    "The export manifest records the public-safety gate version and source fingerprint."]) containsText(home, key);
  for (const key of ["Author privately", "Project publicly", "Gate payloads", "Build and verify", "Current public snapshot"]) containsText(page, key);
  assert.ok(home.includes(escapeHtml(tr("{n} records tracked in the public export manifest.").replace("{n}", formatNumber(12345)))));
  assert.ok(page.includes(escapeHtml(tr("{artifacts} artifacts, {records} manifest records").replace("{artifacts}", formatNumber(1)).replace("{records}", formatNumber(12345)))));
  assert.ok(page.includes(EXPORT_PROVENANCE.source_fingerprint));
  assert.ok(page.includes("2026-11-13T12:00:00Z"));
  assert.ok(page.includes("sha256:aaaaaaaaaaaa"));
  for (const html of [home, page]) {
    assert.ok(html.includes(escapeHtml(EXPORT_PROVENANCE.gate_version)));
    assert.ok(!html.includes("<img src=x"));
  }
});
