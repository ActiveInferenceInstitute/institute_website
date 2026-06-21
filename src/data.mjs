// ── Foundation data module ───────────────────────────────────────────────────
// The single load-time-stateful module. Everything that reads siteData, the
// derived Maps, or export provenance imports from here. It performs all the
// load-time side effects (the big site-data load + derived Maps/Set) so import
// order elsewhere never matters. It imports ONLY node builtins, so it is a pure
// leaf in the import graph: its top-level consts are fully initialized before any
// consumer's module body runs, and no value cycle can ever form.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contentDir = path.join(root, "src", "content");

export function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, relativePath), "utf8"));
}

// Public site version (decoupled from the private library) + export provenance.
// Provenance is read from the export manifest so the build stays byte-stable:
// it changes only when the exported public data changes, never per build run.
export const SITE_VERSION = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const _manifestPath = path.join(root, "data", "export-manifest.json");
export const EXPORT_PROVENANCE = fs.existsSync(_manifestPath)
  ? JSON.parse(fs.readFileSync(_manifestPath, "utf8"))
  : {};
export const SOURCE_FINGERPRINT = EXPORT_PROVENANCE.source_fingerprint || "";
export const EXPORTED_AT = EXPORT_PROVENANCE.generated_at || "";

// The machine-readable public projects feed lives at the repo root (data/),
// outside src/content. Loaded once and reused for related-projects + domain
// cross-linking.
let _projectsData = null;
export function loadProjectsData() {
  if (_projectsData === null) {
    const file = path.join(root, "data", "projects.json");
    _projectsData = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { projects: [] };
  }
  return _projectsData;
}

// Pages may live directly under src/content/pages or in maintainer-facing
// taxonomy subfolders (institute/, programs/, participate/, projects/,
// communications/). Walk the tree recursively so every .json is loaded
// regardless of nesting. The page slug field stays the identity that maps to a
// FLAT <slug>.html output path — folder placement never affects output URLs.
function walkPageJson(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkPageJson(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      found.push(full);
    }
  }
  return found;
}

const pagesDir = path.join(contentDir, "pages");
const pages = walkPageJson(pagesDir)
  .map((full) => loadJson(path.relative(contentDir, full)))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug));

export const siteData = {
  site: loadJson("site.json"),
  navigation: loadJson("navigation.json"),
  social: loadJson("social.json"),
  metrics: loadJson("metrics.json"),
  liveSources: loadJson("live-sources.json"),
  resources: loadJson("resources.json"),
  officialPages: loadJson("official-pages.json"),
  repositories: loadJson("repositories.json"),
  audiencePathways: loadJson("audience-pathways.json"),
  instituteos: {
    people: loadJson(path.join("instituteos", "people.json")),
    projects: loadJson(path.join("instituteos", "projects.json")),
    ideas: loadJson(path.join("instituteos", "ideas.json")),
    ontology: loadJson(path.join("instituteos", "ontology.json")),
    assets: loadJson(path.join("instituteos", "assets.json")),
    entities: loadJson(path.join("instituteos", "entities.json")),
    processes: loadJson(path.join("instituteos", "processes.json")),
    communications: loadJson(path.join("instituteos", "communications.json")),
    policies: loadJson(path.join("instituteos", "policies.json")),
    techTreeGraph: loadJson(path.join("instituteos", "tech_tree_graph.json")),
    ontologyGraph: loadJson(path.join("instituteos", "ontology_graph.json")),
    governanceGraph: loadJson(path.join("instituteos", "governance_graph.json")),
    domainProjects: loadJson(path.join("instituteos", "domain_projects.json")),
    narratives: loadJson(path.join("instituteos", "narratives_public.json")),
  },
  pages,
};

export const liveSourceById = new Map((siteData.liveSources.sources || []).map((source) => [source.id, source]));
// Every reachable public URL (plus trailing-slash variants) backed by the live
// source registry. Used to gate raw registry URLs: an external anchor may only
// be emitted when its href is represented here, matching the static-security
// and site-contract checks.
export const liveSourceUrlSet = new Set();
for (const source of siteData.liveSources.sources || []) {
  if (source.ok && source.url) {
    const clean = source.url.replace(/\/+$/, "");
    liveSourceUrlSet.add(source.url);
    liveSourceUrlSet.add(clean);
    liveSourceUrlSet.add(`${clean}/`);
  }
}
export const pageBySlug = new Map(siteData.pages.map((page) => [page.slug, page]));
export const typeById = new Map((siteData.resources.types || []).map((type) => [type.id, type]));
export const categoryById = new Map((siteData.resources.categories || []).map((category) => [category.id, category]));
export const audienceById = new Map((siteData.resources.audiences || []).map((audience) => [audience.id, audience]));

// Reverse map: a clean directory ("projects/x", "about", "") back to the slug
// that produced it. Lets authors write dir-agnostic clean references (a leading
// "/<dir>/" path) that re-resolve relative to the current page. Built once.
export const ALL_ROUTED_SLUGS = [
  "index",
  ...siteData.pages.map((page) => page.slug),
  "knowledge",
  "resources",
  "directory",
  "search",
  "sitemap",
];
