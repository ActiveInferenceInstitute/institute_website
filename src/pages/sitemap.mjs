import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { siteData, ALL_ROUTED_SLUGS } from "../data.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";
import { metaDescription } from "../render/seo.mjs";
import { dataTable } from "../render/tables.mjs";

// Human-readable HTML sitemap (/sitemap/). Emitted programmatically like the
// search/directory pages (NOT a curated src/content/pages JSON), so it is not
// subject to the curated-page contract. It lists every routed slug, drawing the
// same slug source the XML sitemap uses so the two cannot drift. All links go
// through hrefForSlug (caller-relative, CSP-safe) — no hardcoded paths.
const SITEMAP_SECTION_LABELS = {
  index: "Home",
  knowledge: "Open Source Map",
  resources: "Resources",
  directory: "Directory",
  search: "Search",
  sitemap: "Sitemap",
};

export function sitemapPage() {
  const currentDir = urlDirForSlug("sitemap");
  const curatedRows = siteData.pages.map((page) => ({
    label: page.title,
    summary: metaDescription(page.lede || page.description || ""),
    href: hrefForSlug(page.slug, currentDir),
  }));
  // Synthetic/section slugs come from the same routed-slug set used by the XML
  // sitemap (ALL_ROUTED_SLUGS minus the curated siteData.pages slugs).
  const curatedSlugs = new Set(siteData.pages.map((page) => page.slug));
  const sectionRows = ALL_ROUTED_SLUGS.filter((slug) => !curatedSlugs.has(slug)).map((slug) => ({
    label: SITEMAP_SECTION_LABELS[slug] || slug,
    summary: "",
    href: hrefForSlug(slug, currentDir),
  }));
  const linkColumn = { label: "Page", render: (item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` };
  const summaryColumn = { label: "Summary", render: (item) => escapeHtml(item.summary) };
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Sitemap</span></nav>
    <p class="eyebrow">Site index</p>
    <h1>Sitemap</h1>
    <p>A human-readable index of every public Active Inference Institute page. The same set of pages is published in the <a href="${hrefForSlug("directory", currentDir)}">directory</a> and as a machine-readable XML sitemap for crawlers.</p>
  </section>
  <section class="content-band" id="sitemap-sections">
    ${sectionHeading({ eyebrow: "Sections", title: "Sections and tools" })}
    ${dataTable({ caption: "Top-level sections and site tools.", columns: [linkColumn], rows: sectionRows })}
  </section>
  <section class="content-band muted" id="sitemap-pages">
    ${sectionHeading({ eyebrow: "Pages", title: `${curatedRows.length} curated public pages` })}
    ${dataTable({ caption: "Every curated public page.", columns: [linkColumn, summaryColumn], rows: curatedRows })}
  </section>`;
  return layout({
    title: "Sitemap",
    description: "Human-readable index of every public Active Inference Institute page.",
    currentDir,
    body,
    slug: "sitemap",
  });
}
