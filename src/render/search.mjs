import { siteData } from "../data.mjs";
import { outputPathForSlug } from "../url-taxonomy.mjs";
import { absoluteUrl } from "./urls.mjs";
import { newsletterIssueOutputPath, newsletterRecords } from "../pages/newsletter.mjs";

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
  for (const record of osm.programs.records || []) {
    entries.push({ t: record.name, u: knowledgeUrl, k: `${record.category || ""} ${(record.topics || []).join(" ")} ${record.summary || ""}`.slice(0, 180), c: "Program" });
  }
  for (const record of osm.citations.records || []) {
    entries.push({ t: record.title, u: knowledgeUrl, k: `${(record.authors || []).join(" ")} ${record.venue || ""} ${record.year || ""} ${(record.tags || []).join(" ")}`.slice(0, 180), c: "Literature" });
  }
  for (const record of osm.entities.people || []) {
    entries.push({ t: record.name, u: knowledgeUrl, k: (record.roles || []).join(" "), c: "Person" });
  }
  // Canonical /search/ URL so the header quick-search can offer a "See all
  // results" link (CSP-safe: a self-origin internal href, no fetch).
  // Calendar: the page itself plus every public event, so the header search and
  // /search/ page surface events by title (self-origin /calendar/ destination).
  const calendarUrl = absoluteUrl(outputPathForSlug("calendar"));
  entries.push({
    t: "Calendar",
    u: calendarUrl,
    k: "events livestreams roundtables model streams open hours schedule",
    c: "Page",
  });
  for (const record of osm.calendar?.records || []) {
    entries.push({
      t: record.title,
      u: calendarUrl,
      k: `${String(record.start || "").slice(0, 10)} ${record.status || ""} event`.trim().slice(0, 180),
      c: "Event",
    });
  }
  // Videos: the page itself plus every public video/podcast, same treatment as
  // Calendar — all entries resolve to the single /video/ page (which has its own
  // in-page filter over the full table), so the header search and /search/ page
  // surface individual recordings by title/series/guest/keyword too.
  const videoUrl = absoluteUrl(outputPathForSlug("video"));
  entries.push({
    t: "Videos and Podcasts",
    u: videoUrl,
    k: "video library livestreams learning group sessions interviews lectures presentations podcast youtube",
    c: "Page",
  });
  for (const record of osm.videos?.videos || []) {
    const guestNames = (record.guests || []).map((g) => g.name).filter(Boolean).join(" ");
    entries.push({
      t: record.title || "Untitled",
      u: videoUrl,
      k: `${record.series || ""} ${String(record.date || "").slice(0, 10)} ${(record.types || []).join(" ")} ${(record.keywords || []).join(" ")} ${(record.ontologyTerms || []).join(" ")} ${guestNames}`
        .trim()
        .slice(0, 180),
      c: "Video",
    });
  }
  // Directory, Resources, Simulations, and Sitemap are programmatically-rendered
  // pages (src/pages/*.mjs), not curated src/content/pages/**/*.json entries, so
  // they never went through the siteData.pages loop above and were entirely
  // absent from the index. Add them the same way Calendar is special-cased,
  // with keyword strings drawn from each page's own real content (resource
  // categories, simulation tiers) so terms used inside those pages are also
  // findable, not just the page titles.
  const resourceCategoryWords = (siteData.resources.categories || []).map((c) => c.label).join(" ").toLowerCase();
  entries.push({
    t: "Directory",
    u: absoluteUrl(outputPathForSlug("directory")),
    k: `global directory official pages repositories resources people index ${resourceCategoryWords}`.slice(0, 180),
    c: "Page",
  });
  entries.push({
    t: "Resources",
    u: absoluteUrl(outputPathForSlug("resources")),
    k: `searchable directory of verified public resources shortlinks guides start docs official pages ${resourceCategoryWords}`.slice(0, 180),
    c: "Page",
  });
  entries.push({
    t: "Simulations",
    u: absoluteUrl(outputPathForSlug("simulations")),
    k: "interactive browser-based active inference free energy principle beginner intermediate advanced learning",
    c: "Page",
  });
  entries.push({
    t: "Sitemap",
    u: absoluteUrl(outputPathForSlug("sitemap")),
    k: "human-readable index of every public page site map navigation",
    c: "Page",
  });
  const newsletterUrl = absoluteUrl(outputPathForSlug("newsletter"));
  entries.push({
    t: "Newsletter",
    u: newsletterUrl,
    k: "public newsletter archive monthly issues announcements updates Substack",
    c: "Page",
  });
  for (const record of newsletterRecords()) {
    entries.push({
      t: record.title || "Newsletter issue",
      u: absoluteUrl(newsletterIssueOutputPath(record.route)),
      k: `${record.type || "communication"} ${record.date || ""} ${(record.tags || []).join(" ")}`.trim().slice(0, 180),
      c: record.type === "newsletter" ? "Newsletter" : "Announcement",
    });
  }
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
