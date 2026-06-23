import path from "node:path";
import { outputPathForSlug, hrefForSlug } from "./url-taxonomy.mjs";
import {
  SITE_VERSION,
  SOURCE_FINGERPRINT,
  EXPORTED_AT,
  siteData,
} from "./data.mjs";
import { writeFile } from "./lib/output.mjs";
import { absoluteUrl } from "./render/urls.mjs";
import { layout } from "./render/layout.mjs";
import { buildSearchIndex } from "./render/search.mjs";
import { buildManifest, buildSecurityTxt } from "./render/metadata.mjs";
import { buildRssFeed, buildJsonFeed } from "./feeds.mjs";
import { homePage, publicPage } from "./render/pages.mjs";
import { knowledgePage } from "./render/knowledge.mjs";
import { ecosystemDomainPages } from "./pages/ecosystem.mjs";
import { directoryPage } from "./pages/directory.mjs";
import { resourcesPage } from "./pages/resources.mjs";
import { searchPage } from "./pages/search.mjs";
import { simulationsPage } from "./pages/simulations.mjs";
import { sitemapPage } from "./pages/sitemap.mjs";

function build() {
  // Every routed page maps to <dir>/index.html via the clean-URL taxonomy.
  // The home page is the only root index.html; 404.html is the only flat file.
  const slugRenderers = [
    ["index", homePage],
    ...siteData.pages.map((page) => [page.slug, () => publicPage(page)]),
    ["knowledge", knowledgePage],
    ["resources", resourcesPage],
    ["directory", directoryPage],
    ["search", searchPage],
    ["simulations", simulationsPage],
    ["sitemap", sitemapPage],
    ...ecosystemDomainPages().map((page) => [page.slug, () => page.html]),
  ];
  for (const [slug, render] of slugRenderers) {
    writeFile(outputPathForSlug(slug), render());
  }
  // 404 stays a flat root file (GitHub Pages requires /404.html). Its links use
  // the root-relative clean paths (currentDir "").
  writeFile(
    "404.html",
    layout({
      title: "Page not found",
      currentDir: "",
      canonicalPath: "404.html",
      robots: "noindex",
      body: `<section class="page-hero compact"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", "")}">Home</a><span aria-hidden="true">/</span><span aria-current="page">404</span></nav><p class="eyebrow">404</p><h1>Page not found</h1><p>That page has moved or never existed. Use the search box above, or jump to a main destination:</p><div class="mini-links"><a href="${hrefForSlug("index", "")}">Home</a><a href="${hrefForSlug("directory", "")}">Directory</a><a href="${hrefForSlug("resources", "")}">Resources</a><a href="${hrefForSlug("knowledge", "")}">Open Source Map</a><a href="${hrefForSlug("get-involved", "")}">Get involved</a><a href="${hrefForSlug("search", "")}">Search</a></div><a class="button primary" href="${hrefForSlug("index", "")}">Back to home</a></section>`,
    }),
  );
  writeFile(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("sitemap.xml")}\n`,
  );
  // Sitemap + version urls: one clean directory URL per routed page (404 excluded).
  // absoluteUrl collapses <dir>/index.html to /<dir>/ (and root to /).
  const urls = slugRenderers.map(([slug]) => outputPathForSlug(slug));
  // lastmod from the export date (stable per export, not a live clock); priority
  // by depth: home 1.0, top-level sections 0.8, deeper collection pages 0.6.
  const lastmod = (EXPORTED_AT || "").slice(0, 10);
  const sitemapPriority = (url) => {
    const depth = url.split("/").filter((part) => part && part !== "index.html").length;
    return depth === 0 ? "1.0" : depth >= 2 ? "0.6" : "0.8";
  };
  // changefreq hint keyed on the same depth metric: home + top-level sections
  // change weekly; deep project/program collection pages change monthly.
  const sitemapChangefreq = (url) => {
    const depth = url.split("/").filter((part) => part && part !== "index.html").length;
    return depth >= 2 ? "monthly" : "weekly";
  };
  writeFile(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (url) =>
          `  <url><loc>${absoluteUrl(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${sitemapChangefreq(url)}</changefreq><priority>${sitemapPriority(url)}</priority></url>`,
      )
      .join("\n")}\n</urlset>\n`,
  );
  // Machine-readable site version + public-safe provenance. built_at mirrors the
  // export timestamp (not a live clock) so the file stays byte-stable per export.
  writeFile(
    "version.json",
    JSON.stringify(
      {
        site_version: SITE_VERSION,
        built_at: EXPORTED_AT || null,
        exported_at: EXPORTED_AT || null,
        source_fingerprint: SOURCE_FINGERPRINT || null,
        pages: urls.length,
        commit: process.env.GITHUB_SHA || null,
      },
      null,
      2,
    ) + "\n",
  );
  // Subscription (RSS + JSON Feed of Institute updates), installable web app
  // manifest, and a responsible-disclosure contact.
  writeFile("feed.xml", buildRssFeed());
  writeFile("feed.json", buildJsonFeed());
  writeFile("manifest.webmanifest", buildManifest());
  writeFile(path.join(".well-known", "security.txt"), buildSecurityTxt());
  writeFile(path.join("assets", "js", "search-data.js"), buildSearchIndex());
  console.log(`Built ${urls.length} public pages plus 404.html`);
}

build();
