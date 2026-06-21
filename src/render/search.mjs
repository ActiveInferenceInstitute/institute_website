import { siteData } from "../data.mjs";
import { outputPathForSlug } from "../url-taxonomy.mjs";
import { absoluteUrl } from "./urls.mjs";

export function buildSearchIndex() {
  // Embedded, self-hosted client-side search index (no fetch — CSP-safe). Curated
  // pages carry unique destinations; Open Source Map records resolve to /knowledge/.
  const knowledgeUrl = absoluteUrl(outputPathForSlug("knowledge"));
  const osm = siteData.instituteos;
  const entries = [];
  for (const page of siteData.pages) {
    entries.push({
      t: page.title,
      u: absoluteUrl(outputPathForSlug(page.slug)),
      k: String(page.description || page.lede || "").slice(0, 180),
      c: "Page",
    });
  }
  for (const record of osm.projects.records || []) {
    entries.push({ t: record.title, u: knowledgeUrl, k: `${record.summary || ""} ${(record.tags || []).join(" ")}`.slice(0, 180), c: "Repository" });
  }
  for (const record of osm.ideas.records || []) {
    entries.push({ t: record.label, u: knowledgeUrl, k: String(record.summary || "").slice(0, 180), c: "Concept" });
  }
  for (const record of osm.policies.records || []) {
    entries.push({ t: record.title, u: knowledgeUrl, k: String(record.category || ""), c: "Policy" });
  }
  for (const record of osm.processes.records || []) {
    entries.push({ t: record.title, u: knowledgeUrl, k: String(record.category || ""), c: "Process" });
  }
  for (const record of osm.entities.people || []) {
    entries.push({ t: record.name, u: knowledgeUrl, k: (record.roles || []).join(" "), c: "Person" });
  }
  // Canonical /search/ URL so the header quick-search can offer a "See all
  // results" link (CSP-safe: a self-origin internal href, no fetch).
  const searchPageUrl = absoluteUrl(outputPathForSlug("search"));
  // Synonym/alias expansion map: a canonical token to equivalent query terms.
  // Used by search.js/search-page.js to BOOST matches (never to require them).
  // All-lowercase and free of any obsolete-text/old-theme tokens so the .js
  // stale-reference gate stays green.
  const SYNONYMS = {
    "active inference": ["actinf", "aif", "free energy"],
    institute: ["aii", "org", "nonprofit"],
    repository: ["repo", "repos", "codebase", "github"],
    person: ["people", "member", "contributor"],
    policy: ["policies", "bylaw", "bylaws"],
    process: ["processes", "procedure", "workflow"],
    learning: ["course", "courses", "education", "tutorial"],
    concept: ["idea", "ideas", "topic"],
  };
  return `window.__SEARCH_INDEX__ = ${JSON.stringify(entries)};\nwindow.__SEARCH_PAGE_URL__ = ${JSON.stringify(searchPageUrl)};\nwindow.__SEARCH_SYNONYMS__ = ${JSON.stringify(SYNONYMS)};\n`;
}
