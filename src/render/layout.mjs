import { SITE_VERSION, SOURCE_FINGERPRINT, siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { hrefForSlug, crossLocaleHref, localeOutputPathForSlug } from "../url-taxonomy.mjs";
import { metaDescription, ogImageForSlug, structuredData } from "./seo.mjs";
import { cspContent } from "./security.mjs";
import { absoluteUrl, relPrefix } from "./urls.mjs";
import { nav, socialLinks } from "./page-sections.mjs";
import { tr, activeLocale, localeMeta, isDefaultLocale, LOCALES, DEFAULT_LOCALE } from "../i18n/index.mjs";

// Language switcher (header) + per-page hreflang alternates (head). Both are
// pure markup — no JS, no network — so they satisfy the strict CSP. The switcher
// links each locale to the equivalent page; hreflang advertises the alternates
// to search engines. When a page has no routed slug (the flat 404), the switcher
// falls back to each locale's home.
function languageSwitcher(slug, currentDir, lang) {
  const items = LOCALES.map((locale) => {
    const href = crossLocaleHref(slug || "index", currentDir, locale.code);
    const current = locale.code === lang ? ' aria-current="true"' : "";
    return `<a hreflang="${locale.code}" lang="${locale.code}" href="${escapeHtml(href)}"${current}>${escapeHtml(locale.nativeName)}</a>`;
  }).join("");
  return `<details class="lang-switcher">
      <summary aria-label="${escapeHtml(tr("Choose language"))}" title="${escapeHtml(tr("Choose language"))}"><span class="lang-globe" aria-hidden="true">🌐</span><span class="lang-current">${escapeHtml(lang.toUpperCase())}</span></summary>
      <nav class="lang-menu" aria-label="${escapeHtml(tr("Language"))}">${items}</nav>
    </details>`;
}

function localeAlternateLinks(slug) {
  if (!slug) {
    return "";
  }
  const links = LOCALES.map(
    (locale) => `\n  <link rel="alternate" hreflang="${locale.code}" href="${escapeHtml(absoluteUrl(localeOutputPathForSlug(slug, locale.code)))}">`,
  ).join("");
  return `${links}\n  <link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(localeOutputPathForSlug(slug, DEFAULT_LOCALE)))}">`;
}

// Map the site's ISO-639 language codes to the Open Graph "language_TERRITORY"
// locale format Facebook/Open Graph expects. Each language uses its primary
// territory (the conventional default), so a shared /es/ page advertises
// og:locale=es_ES, /en → en_US, etc. Only emits values for known codes; unknown
// codes fall back to "en_US" so the tag is never malformed.
const OG_TERRITORY = {
  en: "US", es: "ES", fr: "FR", de: "DE", pt: "PT", it: "IT",
  ru: "RU", zh: "CN", ja: "JP", ko: "KR", hi: "IN", ar: "SA",
};
function ogLocaleFor(code) {
  return OG_TERRITORY[code] ? `${code}_${OG_TERRITORY[code]}` : "en_US";
}

// Alternate-version Open Graph locale tags for the other 11 locales, matching
// the hreflang alternates so crawlers/sharers know the page has translations.
function ogLocaleAlternatesFor(currentLang) {
  return LOCALES.filter((l) => l.code !== currentLang)
    .map((l) => `<meta property="og:locale:alternate" content="${escapeHtml(ogLocaleFor(l.code))}">`)
    .join(" ");
}

export function layout({ title, description, currentDir = "", canonicalPath, body, bodyClass = "", slug = "", robots = "", ogType, redirects = false, hreflang = true } = {}) {
  const prefix = relPrefix(currentDir);
  const lang = activeLocale();
  const meta = localeMeta(lang);
  const dirAttr = meta.dir === "rtl" ? ' dir="rtl"' : "";
  // A noindexed page must not advertise itself as part of an hreflang cluster,
  // and pages whose locale variants are noindexed (hreflang: false) advertise
  // none at all — Google treats hreflang links to noindexed URLs as conflicting
  // signals and picks its own canonical.
  const hreflangLinks = hreflang && !robots.includes("noindex") ? localeAlternateLinks(slug) : "";
  // Machine-translated locales carry a visible, honest provenance note linking
  // back to the authoritative English original.
  const mtNotice =
    !isDefaultLocale(lang) && meta.machine && slug
      ? `<p class="mt-notice" role="note"><span aria-hidden="true">🌐</span> ${escapeHtml(tr("This page was machine-translated from English."))} <a href="${escapeHtml(crossLocaleHref(slug, currentDir, DEFAULT_LOCALE))}" hreflang="en" lang="en">${escapeHtml(tr("View the English original."))}</a></p>`
      : "";
  // Per-page Open Graph / Twitter card image (falls back to the shared card).
  const ogImage = ogImageForSlug(slug);
  // Brand link points to the CURRENT locale's home (not the site root), so
  // navigating "home" keeps the visitor in their chosen language.
  const homeHref = hrefForSlug("index", currentDir);
  // Translate the page title and description for the active locale so the <head>
  // metadata (title, meta description, OG/Twitter) matches the localized body —
  // otherwise all 11 machine-translated locales advertise English titles/descs
  // to search engines. tr() falls back to the English source when a locale is
  // missing a catalog entry, and the brand name is left untranslated (it is a
  // proper noun, not a UI string, so it is never keyed in the catalogs).
  const localizedTitle = tr(title);
  const pageTitle =
    localizedTitle === siteData.site.name ? localizedTitle : `${localizedTitle} | ${siteData.site.name}`;
  const pageDescription = metaDescription(tr(description || siteData.site.description));
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
  // loads the full-results renderer AND the embedded search index eagerly (it
  // renders the FULL set and prefills from ?q=). Every other page ships only the
  // lightweight header quick-search (search.js), which lazy-loads search-data.js
  // on first user engagement — the index is ~49KB gzipped, so keeping it off the
  // other 10,000+ pages is a meaningful page-weight win. Both scripts are 'self'
  // origin, satisfying script-src 'self' (no fetch, CSP-safe).
  const hasSearchPage = normalizedBody.includes("search-page-mount");
  const searchPageScript = hasSearchPage ? `\n  <script src="${prefix}assets/js/search-data.js" defer></script>\n  <script src="${prefix}assets/js/search-page.js" defer></script>` : "";
  // Pass the (locale-relative) search-data path to the header quick-search so it
  // can lazy-inject the index on demand; it degrades to no-op if absent.
  const searchDataSrc = `${prefix}assets/js/search-data.js`;
  // Only the /video/ page (which embeds a #video-table-mount region) loads the
  // client-side row filter. It filters DOM rows already rendered server-side —
  // no fetch, no external index, CSP-safe.
  const hasVideoTable = normalizedBody.includes("video-table-mount");
  const videoTableScript = hasVideoTable ? `\n  <script src="${prefix}assets/js/video-table.js" defer></script>` : "";
  // Legacy-URL redirects load ONLY on the 404 page (GitHub Pages' catch-all for
  // any unmatched path). The script is referenced by an ABSOLUTE base path so it
  // resolves even when the unmatched request is several segments deep (relative
  // asset paths would break there). It reads its own base from data-base to build
  // destinations, so it works at both the apex root and the /institute_website/
  // project-page base. See assets/js/redirects.js.
  const basePathname = new URL(siteData.site.baseUrl).pathname;
  const redirectScript = redirects
    ? `\n  <script src="${basePathname}assets/js/redirects.js" data-base="${escapeHtml(basePathname)}" defer></script>`
    : "";
  return `<!doctype html>
<html lang="${escapeHtml(lang)}"${dirAttr}>
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
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">${hreflangLinks}
  <meta property="og:type" content="${escapeHtml(resolvedOgType)}">
  <meta property="og:site_name" content="${escapeHtml(siteData.site.name)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:locale" content="${escapeHtml(ogLocaleFor(lang))}">${ogLocaleAlternatesFor(lang)}
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(`${siteData.site.name} — ${pageTitle}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@InferenceActive">
  <meta name="twitter:creator" content="@InferenceActive">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="generator" content="institute_website v${SITE_VERSION}">
  <link rel="stylesheet" href="${prefix}assets/css/instituteos-ds.css">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">${graphStyle}${structuredData(localizedTitle, currentDir, canonicalUrl, slug, pageDescription, !!robots, lang)}
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">${escapeHtml(tr("Skip to content"))}</a>
  <header class="site-header">
    <a class="brand" href="${homeHref}" aria-label="${escapeHtml(siteData.site.name)} home">
      <span class="brand-mark" aria-hidden="true">π</span>
      <span>
        <strong>${escapeHtml(siteData.site.name)}</strong>
        <em>${escapeHtml(siteData.site.tagline)}</em>
      </span>
    </a>
    <!-- Mobile nav disclosure. CSP-safe: no inline handlers — site.js wires the
         click listener and stamps data-nav-js on the header; without JS the
         button stays hidden and the nav renders expanded (styles.css). -->
    <button type="button" id="nav-toggle" class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-icon" aria-hidden="true">☰</span><span class="nav-toggle-label">${escapeHtml(tr("Menu"))}</span></button>
    ${nav(currentDir)}
    <div class="site-search" role="search">
      <input type="search" id="site-search-input" placeholder="${escapeHtml(tr("Search the Institute…"))}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-label="${escapeHtml(tr("Search the site"))}" aria-controls="site-search-results" aria-expanded="false">
      <div id="site-search-results" class="site-search-results" role="listbox" aria-label="${escapeHtml(tr("Search results"))}" hidden></div>
      <p id="site-search-status" class="sr-only" aria-live="polite"></p>
    </div>
    ${languageSwitcher(slug, currentDir, lang)}
    <button type="button" id="tts-toggle" class="tts-toggle" hidden aria-pressed="false" aria-label="${escapeHtml(tr("Listen to this page"))}" title="${escapeHtml(tr("Listen to this page"))}"><span class="tts-toggle-icon" aria-hidden="true">🔊</span></button>
    <div class="accent-control">
      <button type="button" id="accent-toggle" class="accent-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="accent-menu" aria-label="${escapeHtml(tr("Choose highlight color"))}" title="${escapeHtml(tr("Choose highlight color"))}"><span class="accent-toggle-dot" aria-hidden="true"></span></button>
      <div id="accent-menu" class="accent-menu" role="group" aria-label="Highlight color" hidden>
        <button type="button" class="accent-swatch" data-accent="red" aria-pressed="true" aria-label="Red highlight (default)" title="Red"></button>
        <button type="button" class="accent-swatch" data-accent="amber" aria-pressed="false" aria-label="Amber highlight" title="Amber"></button>
        <button type="button" class="accent-swatch" data-accent="green" aria-pressed="false" aria-label="Green highlight" title="Green"></button>
        <button type="button" class="accent-swatch" data-accent="teal" aria-pressed="false" aria-label="Teal highlight" title="Teal"></button>
        <button type="button" class="accent-swatch" data-accent="blue" aria-pressed="false" aria-label="Blue highlight" title="Blue"></button>
        <button type="button" class="accent-swatch" data-accent="violet" aria-pressed="false" aria-label="Violet highlight" title="Violet"></button>
        <button type="button" class="accent-swatch" data-accent="magenta" aria-pressed="false" aria-label="Magenta highlight" title="Magenta"></button>
      </div>
    </div>
    <button type="button" id="theme-toggle" class="theme-toggle" aria-label="${escapeHtml(tr("Switch theme"))}" aria-pressed="false" title="${escapeHtml(tr("Toggle light/dark theme"))}"><span class="theme-toggle-icon" aria-hidden="true">◐</span></button>
  </header>
  <main id="main">
    ${mtNotice}${normalizedBody}
  </main>
  <footer class="site-footer">
    <div>
      <strong>${escapeHtml(siteData.site.name)}</strong>
      <p>${escapeHtml(tr(siteData.site.description))}</p>
    </div>
    <nav class="footer-links" aria-label="${escapeHtml(tr("Footer"))}">
      <a href="${hrefForSlug("about", currentDir)}">${escapeHtml(tr("About"))}</a>
      <a href="${hrefForSlug("projects", currentDir)}">${escapeHtml(tr("Projects"))}</a>
      <a href="${hrefForSlug("programs", currentDir)}">${escapeHtml(tr("Programs"))}</a>
      <a href="${hrefForSlug("directory", currentDir)}">${escapeHtml(tr("Directory"))}</a>
      <a href="${hrefForSlug("resources", currentDir)}">${escapeHtml(tr("Resources"))}</a>
      <a href="${hrefForSlug("knowledge", currentDir)}">${escapeHtml(tr("Open Source Map"))}</a>
      <a href="${hrefForSlug("get-involved", currentDir)}">${escapeHtml(tr("Get involved"))}</a>
      <a href="${hrefForSlug("search", currentDir)}">${escapeHtml(tr("Search"))}</a>
      <a href="${hrefForSlug("sitemap", currentDir)}">${escapeHtml(tr("Sitemap"))}</a>
      <a href="mailto:${escapeHtml(siteData.site.email)}">${escapeHtml(siteData.site.email)}</a>
    </nav>
    <div class="social-links" aria-label="${escapeHtml(tr("Verified public links"))}">
      ${socialLinks()}
    </div>
    <p class="build-stamp">v${escapeHtml(SITE_VERSION)}${SOURCE_FINGERPRINT ? ` · build ${escapeHtml(SOURCE_FINGERPRINT)}` : ""}</p>
  </footer>
  <script src="${prefix}assets/js/theme.js" defer></script>
  <script src="${prefix}assets/js/accent.js" defer></script>
  <script src="${prefix}assets/js/tts.js" defer></script>
  <script src="${prefix}assets/js/site.js" defer></script>
  <script src="${prefix}assets/js/search.js" data-search-data="${escapeHtml(searchDataSrc)}" defer></script>${searchPageScript}${graphScript}${videoTableScript}${redirectScript}
</body>
</html>`;
}
