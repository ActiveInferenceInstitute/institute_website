import { SITE_VERSION, SOURCE_FINGERPRINT, siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";
import { metaDescription, ogImageForSlug, structuredData } from "./seo.mjs";
import { cspContent } from "./security.mjs";
import { absoluteUrl, relPrefix } from "./urls.mjs";
import { nav, socialLinks } from "./page-sections.mjs";

export function layout({ title, description, currentDir = "", canonicalPath, body, bodyClass = "", slug = "", robots = "", ogType } = {}) {
  const prefix = relPrefix(currentDir);
  // Per-page Open Graph / Twitter card image (falls back to the shared card).
  const ogImage = ogImageForSlug(slug);
  const homeHref = prefix || "./";
  const pageTitle = title === siteData.site.name ? title : `${title} | ${siteData.site.name}`;
  const pageDescription = metaDescription(description || siteData.site.description);
  // Content/detail pages are articles; section hubs and the root are websites.
  const resolvedOgType = ogType || (slug.startsWith("project-") ? "article" : "website");
  const robotsTag = robots ? `\n  <meta name="robots" content="${escapeHtml(robots)}">` : "";
  // canonicalPath overrides for the flat 404 file; otherwise derive from the dir.
  const canonicalUrl = absoluteUrl(canonicalPath ?? (currentDir ? `${currentDir}/index.html` : "index.html"));
  const normalizedBody = body.trim();
  // Only pages that embed at least one .graph-mount load the graph renderer and
  // its stylesheet (both 'self' origin, satisfying script-src/style-src 'self').
  const hasGraph = normalizedBody.includes("graph-mount");
  const graphStyle = hasGraph ? `\n  <link rel="stylesheet" href="${prefix}assets/css/graphs.css">` : "";
  const graphScript = hasGraph ? `\n  <script src="${prefix}assets/js/graphs.js" defer></script>` : "";
  // Only the dedicated /search/ page (which embeds a #search-page-mount region)
  // loads the full-results renderer. It reads the same embedded search index
  // (search-data.js, 'self' origin) — no fetch, CSP-safe.
  const hasSearchPage = normalizedBody.includes("search-page-mount");
  const searchPageScript = hasSearchPage ? `\n  <script src="${prefix}assets/js/search-page.js" defer></script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspContent())}">
  <meta name="referrer" content="strict-origin-when-cross-origin">${robotsTag}
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f9fafb">
  <link rel="icon" type="image/svg+xml" href="${prefix}assets/img/icon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="${prefix}assets/img/favicon-32.png">
  <link rel="apple-touch-icon" href="${prefix}assets/img/icon-180.png">
  <link rel="manifest" href="${prefix}manifest.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteData.site.name)} — Updates" href="${prefix}feed.xml">
  <link rel="alternate" type="application/feed+json" title="${escapeHtml(siteData.site.name)} — Updates" href="${prefix}feed.json">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="${escapeHtml(resolvedOgType)}">
  <meta property="og:site_name" content="${escapeHtml(siteData.site.name)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(`${siteData.site.name} — ${pageTitle}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="generator" content="institute_website v${SITE_VERSION}">
  <link rel="stylesheet" href="${prefix}assets/css/instituteos-ds.css">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">${graphStyle}${structuredData(title, currentDir, canonicalUrl, slug, pageDescription, !!robots)}
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="${homeHref}" aria-label="${escapeHtml(siteData.site.name)} home">
      <span class="brand-mark">AI</span>
      <span>
        <strong>${escapeHtml(siteData.site.name)}</strong>
        <em>${escapeHtml(siteData.site.tagline)}</em>
      </span>
    </a>
    ${nav(currentDir)}
    <div class="site-search" role="search">
      <input type="search" id="site-search-input" placeholder="Search the Institute…" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-label="Search the site" aria-controls="site-search-results" aria-expanded="false">
      <div id="site-search-results" class="site-search-results" role="listbox" aria-label="Search results" hidden></div>
    </div>
    <button type="button" id="tts-toggle" class="tts-toggle" hidden aria-pressed="false" aria-label="Listen to this page" title="Listen to this page"><span class="tts-toggle-icon" aria-hidden="true">🔊</span></button>
    <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Switch theme" aria-pressed="false" title="Toggle light/dark theme"><span class="theme-toggle-icon" aria-hidden="true">◐</span></button>
  </header>
  <main id="main">
    ${normalizedBody}
  </main>
  <footer class="site-footer">
    <div>
      <strong>${escapeHtml(siteData.site.name)}</strong>
      <p>${escapeHtml(siteData.site.description)}</p>
    </div>
    <nav class="footer-links" aria-label="Footer">
      <a href="${hrefForSlug("about", currentDir)}">About</a>
      <a href="${hrefForSlug("projects", currentDir)}">Projects</a>
      <a href="${hrefForSlug("programs", currentDir)}">Programs</a>
      <a href="${hrefForSlug("directory", currentDir)}">Directory</a>
      <a href="${hrefForSlug("resources", currentDir)}">Resources</a>
      <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>
      <a href="${hrefForSlug("get-involved", currentDir)}">Get involved</a>
      <a href="${hrefForSlug("search", currentDir)}">Search</a>
      <a href="${hrefForSlug("sitemap", currentDir)}">Sitemap</a>
      <a href="mailto:${escapeHtml(siteData.site.email)}">${escapeHtml(siteData.site.email)}</a>
    </nav>
    <div class="social-links" aria-label="Verified public links">
      ${socialLinks()}
    </div>
    <p class="build-stamp">v${escapeHtml(SITE_VERSION)}${SOURCE_FINGERPRINT ? ` · build ${escapeHtml(SOURCE_FINGERPRINT)}` : ""}</p>
  </footer>
  <script src="${prefix}assets/js/theme.js" defer></script>
  <script src="${prefix}assets/js/tts.js" defer></script>
  <script src="${prefix}assets/js/site.js" defer></script>
  <script src="${prefix}assets/js/search-data.js" defer></script>
  <script src="${prefix}assets/js/search.js" defer></script>${searchPageScript}${graphScript}
</body>
</html>`;
}
