import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { layout } from "../render/layout.mjs";
import { buildSearchIndex } from "../render/search.mjs";

// Dedicated full-text search page (/search/). Emitted programmatically like the
// knowledge/directory pages — NOT a curated src/content/pages JSON, so it is not
// subject to the curated-page contract. It reuses the embedded search index
// (search-data.js) and a self-hosted enhancement script (search-page.js) that
// renders the FULL grouped result set and prefills from the ?q= query string.
export function searchPage() {
  const currentDir = urlDirForSlug("search");
  // Count of embedded index entries (matches buildSearchIndex's first line).
  const indexLine = buildSearchIndex().split("\n", 1)[0];
  const indexCount = JSON.parse(indexLine.replace(/^window\.__SEARCH_INDEX__ = /, "").replace(/;\s*$/, "")).length;
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Search</span></nav>
    <p class="eyebrow">Site search</p>
    <h1>Search the Institute</h1>
    <p>Search every public page, repository, concept, policy, process, and person indexed by this site. Results are grouped by type and drawn from the embedded, self-hosted search index — no network requests.</p>
  </section>
  <section class="content-band" id="search-page-mount">
    <div class="search-page" role="search">
      <label class="search-page-label" for="search-page-input">Search ${indexCount} indexed entries</label>
      <input type="search" id="search-page-input" name="q" class="search-page-input" placeholder="Search pages, repositories, concepts, policies, processes, and people…" autocomplete="off" spellcheck="false" aria-describedby="search-page-status" aria-controls="search-page-results">
      <p id="search-page-status" class="search-page-status" role="status" aria-live="polite">Type at least two characters to search.</p>
    </div>
    <div id="search-page-results" class="search-page-results" aria-live="polite"></div>
    <noscript><p>Enable JavaScript to use site search, or browse the <a href="${hrefForSlug("directory", currentDir)}">global directory</a> and <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>.</p></noscript>
  </section>`;
  return layout({
    title: "Search",
    description: "Search every public Active Inference Institute page, repository, concept, policy, process, and person.",
    currentDir,
    body,
    slug: "search",
  });
}
