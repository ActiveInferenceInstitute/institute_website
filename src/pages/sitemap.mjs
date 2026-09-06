import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { tr, activeLocale, isDefaultLocale } from "../i18n/index.mjs";
import { siteData, ALL_ROUTED_SLUGS } from "../data.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";
import { metaDescription } from "../render/seo.mjs";
import { dataTable } from "../render/tables.mjs";
import { ecosystemTopics } from "./ecosystem.mjs";

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
  simulations: "Simulations",
  sitemap: "Sitemap",
  newsletter: "Newsletter",
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
    label: SITEMAP_SECTION_LABELS[slug] ? tr(SITEMAP_SECTION_LABELS[slug]) : slug,
    summary: "",
    href: hrefForSlug(slug, currentDir),
  }));
  // Ecosystem topic pages are routed programmatically (not curated page JSON),
  // so they are absent from siteData.pages and from ALL_ROUTED_SLUGS. List them
  // from the same generator that emits them, so the two cannot drift.
  const topicRows = ecosystemTopics().map((topic) => ({
    label: topic.label ?? topic.title,
    summary: topic.projects.length
      ? topic.projects.length === 1
        ? tr("1 public project mapped to this topic.")
        : tr("{n} public projects mapped to this topic.").replace("{n}", topic.projects.length)
      : tr("Public Institute narrative for this area of the Active Inference ecosystem."),
    href: hrefForSlug(`ecosystem/${topic.slug}`, currentDir),
  }));
  const linkColumn = { label: tr("Page"), render: (item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` };
  const summaryColumn = { label: tr("Summary"), render: (item) => escapeHtml(item.summary) };
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="${escapeHtml(tr("Breadcrumb"))}"><a href="${hrefForSlug("index", currentDir)}">${escapeHtml(tr("Home"))}</a><span aria-hidden="true">/</span><span>${escapeHtml(tr("Sitemap"))}</span></nav>
    <p class="eyebrow">${escapeHtml(tr("Site index"))}</p>
    <h1>${escapeHtml(tr("Sitemap"))}</h1>
    <p>${escapeHtml(tr("A human-readable index of every public Active Inference Institute page. The same set of pages is published in the"))} <a href="${hrefForSlug("directory", currentDir)}">${escapeHtml(tr("directory"))}</a> ${escapeHtml(tr("and as a machine-readable XML sitemap for crawlers."))}</p>
  </section>
  <section class="content-band" id="sitemap-sections">
    ${sectionHeading({ eyebrow: "Sections", title: "Sections and tools" })}
    ${dataTable({ caption: tr("Top-level sections and site tools."), columns: [linkColumn], rows: sectionRows })}
  </section>
  <section class="content-band muted" id="sitemap-pages">
    ${sectionHeading({ eyebrow: "Pages", title: tr("{n} curated public pages").replace("{n}", curatedRows.length) })}
    ${dataTable({ caption: tr("Every curated public page."), columns: [linkColumn, summaryColumn], rows: curatedRows })}
  </section>
  <section class="content-band" id="sitemap-topics">
    ${sectionHeading({ eyebrow: "Topics", title: tr("{n} ecosystem topic pages").replace("{n}", topicRows.length) })}
    ${dataTable({ caption: tr("Every ecosystem topic page."), columns: [linkColumn, summaryColumn], rows: topicRows })}
  </section>`;
  return layout({
    title: tr("Sitemap"),
    description: tr("Human-readable index of every public Active Inference Institute page."),
    currentDir,
    body,
    slug: "sitemap",
    // The localized sitemap variants are utility indexes whose content is not
    // meaningfully different from the English page, so Google folds them into
    // one canonical anyway (GSC duplicate-canonical report, 2026-07). Make the
    // markup match that intent: only the default-locale page is indexable, and
    // no locale variant advertises an hreflang cluster.
    robots: isDefaultLocale(activeLocale()) ? "" : "noindex,follow",
    hreflang: false,
  });
}
