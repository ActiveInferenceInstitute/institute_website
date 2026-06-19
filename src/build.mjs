import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "src", "content");

const out = (...parts) => path.join(root, ...parts);
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, relativePath), "utf8"));
}

// Public site version (decoupled from the private library) + export provenance.
// Provenance is read from the export manifest so the build stays byte-stable:
// it changes only when the exported public data changes, never per build run.
const SITE_VERSION = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const _manifestPath = path.join(root, "data", "export-manifest.json");
const EXPORT_PROVENANCE = fs.existsSync(_manifestPath)
  ? JSON.parse(fs.readFileSync(_manifestPath, "utf8"))
  : {};
const SOURCE_FINGERPRINT = EXPORT_PROVENANCE.source_fingerprint || "";
const EXPORTED_AT = EXPORT_PROVENANCE.generated_at || "";

// The machine-readable public projects feed lives at the repo root (data/),
// outside src/content. Loaded once and reused for related-projects + domain
// cross-linking.
let _projectsData = null;
function loadProjectsData() {
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

const siteData = {
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

const liveSourceById = new Map((siteData.liveSources.sources || []).map((source) => [source.id, source]));
// Every reachable public URL (plus trailing-slash variants) backed by the live
// source registry. Used to gate raw registry URLs: an external anchor may only
// be emitted when its href is represented here, matching the static-security
// and site-contract checks.
const liveSourceUrlSet = new Set();
for (const source of siteData.liveSources.sources || []) {
  if (source.ok && source.url) {
    const clean = source.url.replace(/\/+$/, "");
    liveSourceUrlSet.add(source.url);
    liveSourceUrlSet.add(clean);
    liveSourceUrlSet.add(`${clean}/`);
  }
}
function isVerifiedExternalUrl(url = "") {
  if (!url) {
    return false;
  }
  return liveSourceUrlSet.has(url) || liveSourceUrlSet.has(url.replace(/\/+$/, ""));
}
const pageBySlug = new Map(siteData.pages.map((page) => [page.slug, page]));
const typeById = new Map((siteData.resources.types || []).map((type) => [type.id, type]));
const categoryById = new Map((siteData.resources.categories || []).map((category) => [category.id, category]));
const audienceById = new Map((siteData.resources.audiences || []).map((audience) => [audience.id, audience]));

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// ── Clean-URL taxonomy ────────────────────────────────────────────────────────
// urlDirForSlug is the ONE source of truth mapping a page slug to its output
// directory (a clean directory URL, no .html). The output file is always
// <dir>/index.html and the canonical URL is /<dir>/ (root "" for the home page).
// 404 is special-cased as a flat root file in build() and is never routed here.
const PROGRAM_SUBPAGE_SLUGS = new Set([
  "fellowship",
  "internship",
  "mentorship",
  "partnership",
  "philanthropy",
]);

function urlDirForSlug(slug) {
  if (slug === "index") {
    return "";
  }
  if (slug.startsWith("project-")) {
    return `projects/${slug.slice("project-".length)}`;
  }
  if (PROGRAM_SUBPAGE_SLUGS.has(slug)) {
    return `programs/${slug}`;
  }
  // projects, programs, about, structure, ecosystem, active-inference, learning,
  // activities, get-involved, volunteer, grants, edactive, reinference,
  // resources, directory, knowledge -> root-level directory.
  return slug;
}

// The output file path for a slug: <dir>/index.html (root index.html for home).
function outputPathForSlug(slug) {
  const dir = urlDirForSlug(slug);
  return dir ? `${dir}/index.html` : "index.html";
}

// Caller-relative clean href from the CURRENT page directory to a target slug.
// Always ends with "/" (the canonical directory URL). The home page resolves to
// the relative path back to the site root (e.g. "../../" from projects/<x>/).
// An optional #anchor is preserved verbatim.
function hrefForSlug(targetSlug, currentDir = "", anchor = "") {
  const targetDir = urlDirForSlug(targetSlug);
  let rel = path.posix.relative(currentDir, targetDir);
  if (rel === "") {
    rel = targetDir === "" ? "./" : "./";
  }
  if (!rel.endsWith("/")) {
    rel += "/";
  }
  const hash = anchor ? (anchor.startsWith("#") ? anchor : `#${anchor}`) : "";
  return `${rel}${hash}`;
}

// Backwards-compatible thin wrapper: slugToHref now resolves a slug to a
// caller-relative clean directory URL. Every caller threads the CURRENT page dir.
const slugToHref = (slug, currentDir = "", anchor = "") => hrefForSlug(slug, currentDir, anchor);

// Parse a legacy "<slug>.html" or "<slug>.html#anchor" literal into its slug and
// optional anchor, so content authored with the old flat hrefs resolves through
// the taxonomy. Returns null when the value is not a flat-page literal.
function parseFlatHref(value = "") {
  const match = /^([a-z0-9-]+)\.html(#.*)?$/i.exec(String(value).trim());
  if (!match) {
    return null;
  }
  return { slug: match[1], anchor: match[2] || "" };
}

// Reverse map: a clean directory ("projects/x", "about", "") back to the slug
// that produced it. Lets authors write dir-agnostic clean references (a leading
// "/<dir>/" path) that re-resolve relative to the current page. Built once.
const ALL_ROUTED_SLUGS = [
  "index",
  ...siteData.pages.map((page) => page.slug),
  "knowledge",
  "resources",
  "directory",
];
const SLUG_FOR_DIR = (() => {
  const map = new Map();
  for (const slug of ALL_ROUTED_SLUGS) {
    map.set(urlDirForSlug(slug), slug);
  }
  return map;
})();
const ROUTED_SLUG_SET = new Set(ALL_ROUTED_SLUGS);

// Resolve any author-supplied internal href to a caller-relative clean URL.
// Accepts:
//  - legacy "<slug>.html[#anchor]" literals (mapped via the taxonomy)
//  - root-absolute clean references "/<dir>/[#anchor]" (mapped back to a slug)
// and passes through external URLs, mailto/tel, bare "#anchor" fragments, and
// already-relative clean directory hrefs unchanged.
function resolveInternalHref(href = "", currentDir = "") {
  if (!href || externalHref(href) || /^(mailto:|tel:|sms:|#)/i.test(href)) {
    return href;
  }
  const parsed = parseFlatHref(href);
  if (parsed) {
    return hrefForSlug(parsed.slug, currentDir, parsed.anchor);
  }
  // Root-absolute clean reference: "/projects/x/", "/about/", "/" (home).
  // Resolve by exact output dir first, then fall back to treating the final path
  // segment as a slug name (so "/partnership/" still maps to the program-subpage
  // slug whose real dir is "programs/partnership").
  if (href.startsWith("/")) {
    const [pathPart, anchorPart = ""] = href.split("#");
    const dir = pathPart.replace(/^\/+/, "").replace(/\/+$/, "");
    const anchor = anchorPart ? `#${anchorPart}` : "";
    const byDir = SLUG_FOR_DIR.get(dir);
    if (byDir) {
      return hrefForSlug(byDir, currentDir, anchor);
    }
    const lastSegment = dir.split("/").filter(Boolean).pop() || "index";
    if (ROUTED_SLUG_SET.has(lastSegment)) {
      return hrefForSlug(lastSegment, currentDir, anchor);
    }
  }
  return href;
}

// Public-safe prose normalizer for free-text sourced from registries/narratives.
// Strips markdown link syntax to its label, removes raw URLs, drops redacted
// email placeholders, and neutralizes private-channel/document tokens so the
// rendered HTML stays inside the public site contract (no Coda/workspace
// wording, no obsolete PDF/atlas references, no external anchors smuggled in as
// bare URLs). Output is plain text and must still be passed through escapeHtml.
function sanitizePublicProse(value = "") {
  let text = String(value);
  // Markdown links/images -> visible label only.
  text = text.replace(/!?\[([^\]]*)\]\((?:[^)]*)\)/g, "$1");
  // Bare URLs -> removed (anchors must come from live-sources.json only).
  text = text.replace(/https?:\/\/[^\s)\]]+/g, "");
  // Redacted email placeholders and leftover empty brackets/parens.
  text = text.replace(/\[?\s*email redacted\s*\]?/gi, "");
  text = text.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
  // Neutralize tokens that trip the public-site scanners.
  const replacements = [
    [/\bcoda\.io\b/gi, "the shared space"],
    [/\bcoda\b/gi, "the shared space"],
    [/\bworkspaces?\b/gi, "shared spaces"],
    [/\bPDF\b/g, "document"],
    [/\bpdfs\b/gi, "documents"],
    [/\bSource Atlas\b/gi, "source map"],
    [/\bSource Manifest\b/gi, "source list"],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  // Collapse markdown bullet artifacts and excess whitespace.
  text = text.replace(/\r/g, "");
  return text;
}

// Split a sanitized narrative body into renderable paragraphs. Markdown list
// markers and blank lines become paragraph breaks; empty fragments are dropped.
function proseParagraphs(value = "") {
  const cleaned = sanitizePublicProse(value);
  return cleaned
    .split(/\n{2,}|\n(?=\s*[-*]\s)/)
    .map((chunk) =>
      chunk
        .split("\n")
        .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        .filter(Boolean)
        .join(" "),
    )
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

// Flatten a node meta object (or scalar) into a single readable string, since
// graphs.js renders node.meta via String(node.meta).
function flattenGraphMeta(meta) {
  if (meta === null || meta === undefined) {
    return undefined;
  }
  if (typeof meta === "string" || typeof meta === "number") {
    return String(meta);
  }
  if (typeof meta === "object") {
    const parts = Object.entries(meta)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${title_case_token_js(k)}: ${v}`);
    return parts.length ? parts.join(" · ") : undefined;
  }
  return undefined;
}

// Project a raw graph dataset (nodes/edges) into the embedded JSON contract:
// node = {id,label,type,href?,meta?}; edge = {source,target,relation}. meta is
// flattened to a string and href is preserved when present.
function projectGraphData({ nodes = [], edges = [] } = {}, currentDir = "") {
  const projectedNodes = nodes.map((node) => {
    const out = {
      id: node.id,
      label: sanitizePublicProse(node.label ?? node.id),
      type: node.type ?? "node",
    };
    if (node.href) {
      // graphs.js renders node.href as a real anchor relative to the page, so
      // resolve internal references to a caller-relative clean URL here.
      out.href = resolveInternalHref(node.href, currentDir);
    }
    const meta = flattenGraphMeta(node.meta);
    if (meta) {
      out.meta = meta;
    }
    return out;
  });
  const projectedEdges = edges
    .filter((edge) => edge && edge.source && edge.target)
    .map((edge) => ({ source: edge.source, target: edge.target, relation: edge.relation ?? "related" }));
  return { nodes: projectedNodes, edges: projectedEdges };
}

// Emit one graph instance per the GRAPH EMBEDDING CONTRACT: a .graph-figure
// wrapper containing an empty .graph-mount (data-graph-source) plus a data
// island whose textContent is the graph JSON. graphs.js discovers each mount,
// reads document.getElementById(source).textContent, and JSON.parses it (it is
// element-type agnostic — it never requires a <script> holder).
//
// The data island is a hidden, non-executable element rather than a
// <script type="application/json"> tag: the static-security gate
// (scripts/check_static_security.py) rejects ANY <script> without a src that
// carries body text, so a JSON <script> would be (incorrectly) flagged as
// inline script. A hidden element is not a <script>, is never executed, and is
// still only readable as embedded data — fully inside script-src/connect-src
// 'none' (no fetch, build-time data only).
//
// JSON is HTML-escaped so the element's textContent survives HTML parsing
// verbatim: "<" -> < (left as literal text; JSON.parse decodes it), and
// "&" -> &amp; (the HTML parser decodes it back to "&" in textContent).
function graphFigure(name, rawData, currentDir = "") {
  const id = `graph-data-${name}`;
  const data = projectGraphData(rawData, currentDir);
  const json = JSON.stringify(data).replace(/&/g, "&amp;").replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<div class="graph-figure">
    <div class="graph-mount" data-graph-source="${id}"></div>
    <div class="graph-data" id="${id}" hidden>${json}</div>
  </div>`;
}

const slugifyAnchor = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Asset/root prefix for the CURRENT page directory, generalized to N levels:
// the number of path segments in the dir determines how many "../" hops reach
// the site root. Root pages (dir "") get "". projects/<x>/ (depth 2) get "../../".
function relPrefix(currentDir = "") {
  if (!currentDir) {
    return "";
  }
  const depth = currentDir.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}

function absoluteUrl(filePath = "") {
  const baseUrl = siteData.site.baseUrl.endsWith("/") ? siteData.site.baseUrl : `${siteData.site.baseUrl}/`;
  let clean = String(filePath).replace(/^\/+/, "");
  if (clean === "index.html") {
    clean = "";
  } else if (clean.endsWith("/index.html")) {
    clean = clean.slice(0, -"index.html".length);
  }
  return new URL(clean, baseUrl).toString();
}

function externalHref(href = "") {
  return /^https?:\/\//.test(href);
}

function linkAttrs(href = "") {
  return externalHref(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function sourceFor(id) {
  const source = liveSourceById.get(id);
  return source && source.ok ? source : null;
}

function publicHrefForSource(source) {
  return source.url;
}

function resolveLink(link) {
  if (!link) {
    return null;
  }
  if (link.sourceId) {
    const source = sourceFor(link.sourceId);
    if (!source) {
      return null;
    }
    return {
      label: link.label || source.label,
      href: publicHrefForSource(source),
      meta: source.category,
      external: true,
    };
  }
  if (link.href && link.label) {
    return {
      label: link.label,
      href: link.href,
      meta: link.meta,
      external: externalHref(link.href),
    };
  }
  return null;
}

function resolveLinks(links = []) {
  return links.map(resolveLink).filter(Boolean);
}

function nav(currentDir = "") {
  const groups = siteData.navigation
    .map((group, index) => {
      const id = `nav-menu-${index}-${slugifyAnchor(group.label)}`;
      const items = (group.items || [])
        .map((item) => `<a href="${escapeHtml(hrefForSlug(item.slug, currentDir, item.anchor || ""))}" role="menuitem">${escapeHtml(item.label)}</a>`)
        .join("");
      return `<div class="nav-group">
        <button class="nav-menu-button" type="button" aria-expanded="false" aria-controls="${id}" data-nav-toggle>
          <span>${escapeHtml(group.label)}</span>
          <span aria-hidden="true">+</span>
        </button>
        <div class="nav-menu" id="${id}" role="menu">${items}</div>
      </div>`;
    })
    .join("");
  return `<nav class="nav" aria-label="Primary">${groups}</nav>`;
}

function socialLinks() {
  return siteData.social
    .map((item) => resolveLink(item))
    .filter(Boolean)
    .map((link) => `<a href="${escapeHtml(link.href)}"${linkAttrs(link.href)}>${escapeHtml(link.label)}</a>`)
    .join("");
}

function actionButtons(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="hero-actions">${resolved
    .map((link, index) => {
      const kind = index === 0 ? "primary" : "secondary";
      const href = resolveInternalHref(link.href, currentDir);
      return `<a class="button ${kind}" href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}

function linkChips(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="link-chips">${resolved
    .map((link) => {
      const meta = link.meta ? `<em>${escapeHtml(link.meta)}</em>` : "";
      const href = resolveInternalHref(link.href, currentDir);
      return `<a href="${escapeHtml(href)}"${linkAttrs(href)}><span>${escapeHtml(link.label)}</span>${meta}</a>`;
    })
    .join("")}</div>`;
}

function linkList(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="mini-links">${resolved
    .map((link) => {
      const href = resolveInternalHref(link.href, currentDir);
      return `<a href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}

function listText(items = [], fallback = "None listed") {
  const cleaned = items.map((item) => String(item || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : fallback;
}

function rowAnchor(prefix, id) {
  return `${prefix}-${slugifyAnchor(id)}`;
}

function cspContent() {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Absolute URL of the social-share / Organization logo image.
const OG_IMAGE = () => absoluteUrl("assets/img/instituteos/ActInferServe.png");

function jsonLdScript(data) {
  // Non-executable schema.org data block. Escape "<" so a "</script>" inside any
  // value cannot break out of the element (the security gate allows ld+json).
  return `\n  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function structuredData(rawTitle, currentDir, canonicalUrl) {
  const base = absoluteUrl("index.html");
  if (!currentDir) {
    return jsonLdScript({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${base}#org`,
          name: siteData.site.name,
          url: base,
          logo: OG_IMAGE(),
          description: siteData.site.description,
          email: siteData.site.email,
        },
        { "@type": "WebSite", "@id": `${base}#website`, url: base, name: siteData.site.name, publisher: { "@id": `${base}#org` } },
      ],
    });
  }
  const items = [{ "@type": "ListItem", position: 1, name: "Home", item: base }];
  const parts = currentDir.split("/").filter(Boolean);
  let position = 2;
  if (parts.length === 2) {
    const section = parts[0];
    items.push({
      "@type": "ListItem",
      position: position++,
      name: section.charAt(0).toUpperCase() + section.slice(1),
      item: absoluteUrl(`${section}/index.html`),
    });
  }
  items.push({ "@type": "ListItem", position, name: rawTitle, item: canonicalUrl });
  return jsonLdScript({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items });
}

function layout({ title, description, currentDir = "", canonicalPath, body, bodyClass = "" }) {
  const prefix = relPrefix(currentDir);
  const homeHref = prefix || "./";
  const pageTitle = title === siteData.site.name ? title : `${title} | ${siteData.site.name}`;
  const pageDescription = description || siteData.site.description;
  // canonicalPath overrides for the flat 404 file; otherwise derive from the dir.
  const canonicalUrl = absoluteUrl(canonicalPath ?? (currentDir ? `${currentDir}/index.html` : "index.html"));
  const normalizedBody = body.trim();
  // Only pages that embed at least one .graph-mount load the graph renderer and
  // its stylesheet (both 'self' origin, satisfying script-src/style-src 'self').
  const hasGraph = normalizedBody.includes("graph-mount");
  const graphStyle = hasGraph ? `\n  <link rel="stylesheet" href="${prefix}assets/css/graphs.css">` : "";
  const graphScript = hasGraph ? `\n  <script src="${prefix}assets/js/graphs.js" defer></script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspContent())}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <meta name="theme-color" content="#050505">
  <link rel="icon" type="image/png" href="${prefix}assets/img/instituteos/ActInferServe.png">
  <link rel="apple-touch-icon" href="${prefix}assets/img/instituteos/ActInferServe.png">
  <link rel="manifest" href="${prefix}manifest.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteData.site.name)} — Updates" href="${prefix}feed.xml">
  <link rel="alternate" type="application/feed+json" title="${escapeHtml(siteData.site.name)} — Updates" href="${prefix}feed.json">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(siteData.site.name)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(OG_IMAGE())}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(OG_IMAGE())}">
  <meta name="generator" content="institute_website v${SITE_VERSION}">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">${graphStyle}${structuredData(title, currentDir, canonicalUrl)}
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
  </header>
  <main id="main">
    ${normalizedBody}
  </main>
  <footer class="site-footer">
    <div>
      <strong>${escapeHtml(siteData.site.name)}</strong>
      <p>${escapeHtml(siteData.site.description)}</p>
    </div>
    <div class="footer-links">
      <a href="mailto:${escapeHtml(siteData.site.email)}">${escapeHtml(siteData.site.email)}</a>
      <a href="${hrefForSlug("resources", currentDir)}">Resources</a>
      <a href="${hrefForSlug("directory", currentDir)}">Directory</a>
      <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>
      <a href="${hrefForSlug("get-involved", currentDir)}">Get involved</a>
    </div>
    <div class="social-links" aria-label="Verified public links">
      ${socialLinks()}
    </div>
    <p class="build-stamp">v${escapeHtml(SITE_VERSION)}${SOURCE_FINGERPRINT ? ` · build ${escapeHtml(SOURCE_FINGERPRINT)}` : ""}</p>
  </footer>
  <script src="${prefix}assets/js/site.js" defer></script>${graphScript}
</body>
</html>`;
}

function sectionHeading({ eyebrow, title, text }) {
  const parts = ['<div class="section-heading">'];
  if (eyebrow) {
    parts.push(`    <p class="eyebrow">${escapeHtml(eyebrow)}</p>`);
  }
  parts.push(`    <h2>${escapeHtml(title)}</h2>`);
  if (text) {
    parts.push(`    <p>${escapeHtml(text)}</p>`);
  }
  parts.push("  </div>");
  return parts.join("\n");
}

function cardGrid(cards = [], currentDir = "") {
  return `<div class="card-grid">${cards
    .map((card) => {
      const links = linkChips(card.links, currentDir);
      return `<article class="info-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>${links ? `\n        ${links}` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function breadcrumb(page, currentDir = "") {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="${hrefForSlug("index", currentDir)}">Home</a>
    <span aria-hidden="true">/</span>
    <a href="${hrefForSlug("directory", currentDir)}">Directory</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(page.title)}</span>
  </nav>`;
}

function pageGuide(page, currentDir = "") {
  const sectionLinks = page.sections
    .map((section) => `<a href="#${escapeHtml(slugifyAnchor(section.heading))}">${escapeHtml(section.heading)}</a>`)
    .join("");
  return `<section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">On this page</p>
        <h2>${escapeHtml(page.title)} guide</h2>
      </div>
      <nav aria-label="${escapeHtml(page.title)} page sections">
        ${sectionLinks}
        <a href="#next-actions">Best next actions</a>
        <a href="#key-surfaces">Key surfaces</a>
        <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>
        <a href="#resources">Related resources</a>
        <a href="#official-pages">Official pages</a>
        <a href="#repositories">Repositories</a>
        <a href="#related-pages">Related pages</a>
      </nav>
    </div>
  </section>`;
}

function relatedSlugsForPage(page) {
  if (Array.isArray(page.relatedSlugs) && page.relatedSlugs.length) {
    return page.relatedSlugs;
  }
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  return [siteData.pages[index - 1]?.slug, siteData.pages[index + 1]?.slug].filter(Boolean);
}

function relatedPages(page, currentDir = "") {
  const related = relatedSlugsForPage(page).map((slug) => pageBySlug.get(slug)).filter(Boolean);
  return `<div class="resource-grid compact-grid">${related
    .map(
      (relatedPage) => `<a class="resource-card internal-card" href="${slugToHref(relatedPage.slug, currentDir)}">
        <span>${escapeHtml(relatedPage.audience || "Related guide")}</span>
        <strong>${escapeHtml(relatedPage.title)}</strong>
        <p>${escapeHtml(relatedPage.lede)}</p>
      </a>`,
    )
    .join("")}</div>`;
}

function audiencePathwaySection(currentDir = "") {
  const pathways = siteData.audiencePathways.pathways || [];
  if (!pathways.length) {
    return "";
  }
  return `<section class="content-band" id="audience-pathways">
    ${sectionHeading({
      eyebrow: "Audience pathways",
      title: "Choose the next useful step",
      text: "These routes organize the same public resource map by visitor intent so people do not need to understand the whole Institute before finding a practical next action.",
    })}
    <div class="pathway-grid">
      ${pathways
        .map((pathway) => `<article class="pathway-card">
          <span>${escapeHtml(pathway.label)}</span>
          <h3>${escapeHtml(pathway.title || pathway.label)}</h3>
          <p>${escapeHtml(pathway.summary)}</p>
          <a class="button secondary" href="${escapeHtml(resolveInternalHref(pathway.primaryHref, currentDir))}">${escapeHtml(pathway.actionLabel || "Open pathway")}</a>
          ${linkList(pathway.links, currentDir)}
        </article>`)
        .join("")}
    </div>
  </section>`;
}

function bestNextActions(page, currentDir = "") {
  const primary = resolveLinks(page.primaryActions || []).slice(0, 3);
  const groups = page.resourceGroups || [];
  const related = relatedSlugsForPage(page)
    .map((slug) => pageBySlug.get(slug))
    .filter(Boolean)
    .slice(0, 2)
    .map((relatedPage) => ({
      label: relatedPage.title,
      href: slugToHref(relatedPage.slug, currentDir),
    }));
  const resourceLinks = [
    groups[0]
      ? { label: "Filtered resources", href: hrefForSlug("resources", currentDir, groups[0]) }
      : { label: "All resources", href: hrefForSlug("resources", currentDir) },
    { label: "Global directory", href: hrefForSlug("directory", currentDir) },
  ];
  const actions = [...primary, ...resourceLinks, ...related];
  return `<section class="content-band next-action-band" id="next-actions">
    <div class="next-action-panel">
      <div>
        <p class="eyebrow">Best next actions</p>
        <h2>${escapeHtml(page.title)} pathway</h2>
        <p>Start with the highest-signal public links for this page, then continue through the related resource and directory views.</p>
      </div>
      ${linkChips(actions, currentDir)}
    </div>
  </section>`;
}

function recordMatchesPage(record, page) {
  const groups = new Set(page.resourceGroups || []);
  return (
    (record.relatedSlugs || []).includes(page.slug) ||
    groups.has(record.category) ||
    (page.externalSourceIds || []).includes(record.sourceId)
  );
}

function normalizedCuratedResources() {
  return (siteData.resources.resources || [])
    .filter((resource) => resource.promoted !== false)
    .map((resource) => normalizeResource(resource, "resource"))
    .filter(Boolean);
}

function normalizedOfficialPages() {
  return (siteData.officialPages.pages || [])
    .filter((item) => item.promoted !== false)
    .map((item) => normalizeResource(item, "official"))
    .filter(Boolean);
}

function normalizedRepositories() {
  return (siteData.repositories.repositories || [])
    .filter((item) => item.promoted !== false)
    .map((item) => normalizeResource(item, "repository"))
    .filter(Boolean);
}

function allResourceEntries() {
  return [...normalizedCuratedResources(), ...normalizedOfficialPages(), ...normalizedRepositories()].sort(
    (a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || a.label.localeCompare(b.label),
  );
}

function uniqueEntries(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.sourceId || entry.href;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeResource(resource, sourceKind) {
  const source = sourceFor(resource.sourceId);
  if (!source) {
    return null;
  }
  const type = resource.type || sourceKind;
  const category = resource.category || "community";
  const audience = resource.audience || "newcomer";
  const tags = resource.tags || [];
  return {
    ...resource,
    source,
    sourceKind,
    type,
    typeLabel: typeById.get(type)?.label || type,
    category,
    categoryLabel: categoryById.get(category)?.label || source.category || category,
    audience,
    audienceLabel: audienceById.get(audience)?.label || audience,
    tags,
    label: resource.title || resource.name || source.label,
    href: publicHrefForSource(source),
    summary: resource.summary || resource.description || source.label,
  };
}

function entriesForPage(page, entries, limit = 8) {
  return entries.filter((entry) => recordMatchesPage(entry, page)).slice(0, limit);
}

function resourceBadge(resource) {
  const parts = [resource.typeLabel].filter(Boolean);
  if (resource.categoryLabel && resource.categoryLabel !== resource.typeLabel) {
    parts.push(resource.categoryLabel);
  }
  return parts.join(" / ");
}

function resourceCards(resources = [], { compact = false, filterable = true, sortable = false, wrapperAttrs = "", currentDir = "" } = {}) {
  if (!resources.length) {
    return '<p class="lede">No public resources are assigned here yet. Use the global directory for the full verified list.</p>';
  }
  const className = compact ? "resource-grid compact-grid" : "resource-grid";
  return `<div class="${className}"${wrapperAttrs}>${resources
    .map((resource) => {
      const related = (resource.relatedSlugs || [])
        .map((slug) => pageBySlug.get(slug))
        .filter(Boolean)
        .map((page) => `<a href="${slugToHref(page.slug, currentDir)}">${escapeHtml(page.title)}</a>`)
        .join("");
      const search = [
        resource.label,
        resource.typeLabel,
        resource.categoryLabel,
        resource.audienceLabel,
        resource.summary,
        resource.tags.join(" "),
        resource.language || "",
      ]
        .join(" ")
        .toLowerCase();
      const tagList = resource.tags.length
        ? `<div class="tag-row">${resource.tags.slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";
      const repoMeta =
        resource.sourceKind === "repository"
          ? `<p class="resource-meta">${escapeHtml(resource.language || "Unspecified")} / ${Number(resource.stars || 0)} stars / updated ${escapeHtml((resource.updatedAt || "").slice(0, 10))}</p>`
          : "";
      const filterAttrs = filterable
        ? ` data-type="${escapeHtml(resource.type)}" data-category="${escapeHtml(resource.category)}" data-audience="${escapeHtml(resource.audience)}" data-tags="${escapeHtml(resource.tags.join(" "))}" data-search="${escapeHtml(search)}"`
        : "";
      const sortAttrs = sortable
        ? ` data-repo-card data-repo-label="${escapeHtml(resource.label.toLowerCase())}" data-repo-stars="${Number(resource.stars || 0)}" data-repo-updated="${escapeHtml(resource.updatedAt || "")}" data-repo-language="${escapeHtml((resource.language || "Unspecified").toLowerCase())}" data-repo-category="${escapeHtml(resource.categoryLabel.toLowerCase())}"`
        : "";
      return `<article class="resource-card"${filterAttrs}${sortAttrs}>
        <span class="resource-kicker">${escapeHtml(resourceBadge(resource))}</span>
        <h3><a href="${escapeHtml(resource.href)}"${linkAttrs(resource.href)}>${escapeHtml(resource.label)}</a></h3>
        <p class="resource-audience">Audience: ${escapeHtml(resource.audienceLabel)}</p>
        <p>${escapeHtml(resource.summary)}</p>
        ${repoMeta}
        ${tagList}
        ${related ? `<div class="mini-links" aria-label="Related pages">${related}</div>` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function tableRows(items, columns) {
  return items
    .map((item) => {
      const cells = columns
        .map((column, index) => {
          const cellTag = column.rowHeader || index === 0 ? "th" : "td";
          const scope = cellTag === "th" ? ' scope="row"' : "";
          return `<${cellTag}${scope}>${column.render(item)}</${cellTag}>`;
        })
        .join("");
      const rowId = item.rowId ? ` id="${escapeHtml(item.rowId)}"` : "";
      const dataAttrs = item.dataAttrs || "";
      return `<tr${rowId}${dataAttrs}>${cells}</tr>`;
    })
    .join("");
}

function tableHead(columns) {
  return columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
}

function dataTable({ caption, columns, rows, className = "directory-table" }) {
  return `<div class="table-wrap"><table class="${className}">
    <caption>${escapeHtml(caption)}</caption>
    <thead><tr>${tableHead(columns)}</tr></thead>
    <tbody>${tableRows(rows, columns)}</tbody>
  </table></div>`;
}

function publicPagePager(page, currentDir = "") {
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  const prev = siteData.pages[index - 1];
  const next = siteData.pages[index + 1];
  return `<nav class="pager page-pager" aria-label="${escapeHtml(page.title)} adjacent pages">
    ${prev ? `<a href="${slugToHref(prev.slug, currentDir)}">Previous: ${escapeHtml(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${slugToHref(next.slug, currentDir)}">Next: ${escapeHtml(next.title)}</a>` : "<span></span>"}
  </nav>`;
}

function brandAsset(theme = "dark") {
  return (siteData.instituteos.assets.records || []).find((asset) => asset.theme === theme) || null;
}

function instituteosCounts() {
  return {
    people: siteData.instituteos.people.records.length,
    projects: siteData.instituteos.projects.records.length,
    ideas: siteData.instituteos.ideas.records.length,
    ontology: siteData.instituteos.ontology.edges.length,
    research: researchRows().length,
    organizations: (siteData.instituteos.entities.organizations || []).length,
    members: (siteData.instituteos.entities.people || []).length,
    processes: (siteData.instituteos.processes.records || []).length,
    publications: (siteData.instituteos.communications.records || []).length,
    policies: (siteData.instituteos.policies.records || []).length,
  };
}

function knowledgeSearchText(values = []) {
  return sanitizePublicProse(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(" "),
  ).toLowerCase();
}

function knowledgeDataAttrs(kind, values = []) {
  return ` data-knowledge-row data-knowledge-kind="${escapeHtml(kind)}" data-knowledge-search="${escapeHtml(knowledgeSearchText(values))}"`;
}

function sourceAnchor(sourceId, label) {
  const source = sourceFor(sourceId);
  if (!source) {
    return escapeHtml(label);
  }
  const href = publicHrefForSource(source);
  return `<a href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(label)}</a>`;
}

function peopleRows(limit = Infinity) {
  return siteData.instituteos.people.records.slice(0, limit).map((person) => ({
    ...person,
    rowId: rowAnchor("person", person.id),
    dataAttrs: knowledgeDataAttrs("people", [person.name, person.login, person.publicRole, person.repositories, person.contributionSummary]),
  }));
}

function projectRows(limit = Infinity) {
  return siteData.instituteos.projects.records.slice(0, limit).map((project) => ({
    ...project,
    rowId: rowAnchor("project", project.id),
    dataAttrs: knowledgeDataAttrs("projects", [
      project.title,
      project.fullName,
      project.category,
      project.projectFamily,
      project.repoType,
      project.language,
      project.summary,
      project.tags,
    ]),
  }));
}

function ideaRows(limit = Infinity) {
  return siteData.instituteos.ideas.records.slice(0, limit).map((idea) => ({
    ...idea,
    rowId: rowAnchor("idea", idea.id),
    dataAttrs: knowledgeDataAttrs("ideas", [idea.label, idea.nodeType, idea.maturity, idea.summary, idea.tags, idea.trees]),
  }));
}

function ontologyRows(limit = Infinity) {
  return siteData.instituteos.ontology.edges.slice(0, limit).map((edge) => ({
    ...edge,
    rowId: rowAnchor("ontology", edge.id),
    dataAttrs: knowledgeDataAttrs("ontology", [
      edge.treeTitle,
      edge.sourceLabel,
      edge.relationship,
      edge.targetLabel,
      edge.edgeType,
      edge.sourceMaturity,
      edge.targetMaturity,
    ]),
  }));
}

function researchRows(limit = Infinity) {
  return normalizedCuratedResources()
    .filter((resource) => resource.type === "research" || resource.category === "research")
    .slice(0, limit)
    .map((resource) => ({
      ...resource,
      rowId: rowAnchor("research", resource.sourceId),
      dataAttrs: knowledgeDataAttrs("research", [
        resource.label,
        resource.categoryLabel,
        resource.audienceLabel,
        resource.summary,
        resource.tags,
      ]),
    }));
}

function entityOrgRows(limit = Infinity) {
  return (siteData.instituteos.entities.organizations || []).slice(0, limit).map((org) => ({
    ...org,
    rowId: rowAnchor("org", org.id),
    dataAttrs: knowledgeDataAttrs("organizations", [org.name, org.type, org.description, org.tags]),
  }));
}

function entityPeopleRows(limit = Infinity) {
  return (siteData.instituteos.entities.people || []).slice(0, limit).map((person) => ({
    ...person,
    rowId: rowAnchor("member", person.id),
    dataAttrs: knowledgeDataAttrs("members", [person.name, person.title, person.roles, person.tags]),
  }));
}

function processRows(limit = Infinity) {
  return (siteData.instituteos.processes.records || []).slice(0, limit).map((proc) => ({
    ...proc,
    rowId: rowAnchor("process", proc.id),
    dataAttrs: knowledgeDataAttrs("processes", [proc.title, proc.category, proc.status, proc.description]),
  }));
}

function communicationRows(limit = Infinity) {
  return (siteData.instituteos.communications.records || []).slice(0, limit).map((comm) => ({
    ...comm,
    rowId: rowAnchor("publication", comm.id),
    dataAttrs: knowledgeDataAttrs("publications", [comm.title, comm.type, comm.date, comm.author]),
  }));
}

function policyRows(limit = Infinity) {
  return (siteData.instituteos.policies.records || []).slice(0, limit).map((pol) => ({
    ...pol,
    rowId: rowAnchor("policy", pol.id),
    dataAttrs: knowledgeDataAttrs("policies", [pol.title, pol.category, pol.status, pol.description, pol.tags]),
  }));
}

function tableSection({ id, eyebrow, title, text, countLabel, tableHtml }) {
  return `<section class="content-band" id="${escapeHtml(id)}">
    ${sectionHeading({ eyebrow, title, text })}
    <p class="category-count" data-knowledge-count="${escapeHtml(id)}">${escapeHtml(countLabel)}</p>
    ${tableHtml}
  </section>`;
}

function peopleTable(rows = peopleRows()) {
  const columns = [
    { label: "Public person", render: (item) => sourceAnchor(item.sourceId, item.name) },
    { label: "GitHub", render: (item) => escapeHtml(`@${item.login}`) },
    { label: "Public basis", render: (item) => escapeHtml(item.publicRole) },
    { label: "Visible repositories", render: (item) => escapeHtml(listText(item.repositories)) },
    { label: "Summary", render: (item) => escapeHtml(item.contributionSummary) },
  ];
  return dataTable({ caption: "Public GitHub people visible in ActiveInferenceInstitute open-source metadata.", columns, rows });
}

function projectsTable(rows = projectRows()) {
  const columns = [
    { label: "Repository", render: (item) => sourceAnchor(item.sourceId, item.title) },
    { label: "Family", render: (item) => escapeHtml(item.projectFamily) },
    { label: "Type", render: (item) => escapeHtml(item.repoType) },
    { label: "Language", render: (item) => escapeHtml(item.language || "Unspecified") },
    { label: "Stars", render: (item) => String(Number(item.stars || 0)) },
    { label: "Updated", render: (item) => escapeHtml((item.updatedAt || "").slice(0, 10)) },
    {
      label: "Docs",
      render: (item) => (item.docsSourceId ? sourceAnchor(item.docsSourceId, "Open docs") : "Repository"),
    },
  ];
  return dataTable({ caption: "Public ActiveInferenceInstitute repositories and open-source project rows.", columns, rows });
}

function ideasTable(rows = ideaRows()) {
  const columns = [
    { label: "Idea", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.label)}</a>` },
    { label: "Type", render: (item) => escapeHtml(title_case_token_js(item.nodeType)) },
    { label: "Maturity", render: (item) => escapeHtml(item.maturity) },
    { label: "Summary", render: (item) => escapeHtml(item.summary) },
    { label: "Tags", render: (item) => escapeHtml(listText(item.tags)) },
    { label: "Tree", render: (item) => escapeHtml(listText(item.trees)) },
  ];
  return dataTable({ caption: "Public ideas and methods from the Active Inference concept graph.", columns, rows });
}

function ontologyTable(rows = ontologyRows()) {
  const columns = [
    { label: "Relationship", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.sourceLabel)} -> ${escapeHtml(item.targetLabel)}</a>` },
    { label: "Tree", render: (item) => escapeHtml(item.treeTitle) },
    { label: "From", render: (item) => escapeHtml(item.sourceLabel) },
    { label: "Relation", render: (item) => escapeHtml(item.relationship) },
    { label: "To", render: (item) => escapeHtml(item.targetLabel) },
    { label: "Maturity", render: (item) => `${escapeHtml(item.sourceMaturity)} -> ${escapeHtml(item.targetMaturity)}` },
  ];
  return dataTable({ caption: "Public ontology relationship table from the Active Inference concept graph.", columns, rows });
}

function researchTable(rows = researchRows()) {
  const columns = [
    { label: "Research link", render: (item) => sourceAnchor(item.sourceId, item.label) },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Audience", render: (item) => escapeHtml(item.audienceLabel) },
    { label: "Summary", render: (item) => escapeHtml(item.summary) },
    { label: "Tags", render: (item) => escapeHtml(listText(item.tags)) },
  ];
  return dataTable({ caption: "Verified public research, paper, and reference links.", columns, rows });
}

function organizationsTable(rows = entityOrgRows()) {
  const columns = [
    {
      label: "Organization",
      render: (item) =>
        item.url && isVerifiedExternalUrl(item.url)
          ? `<a href="${escapeHtml(item.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(item.name)}</a>`
          : escapeHtml(item.name),
    },
    { label: "Type", render: (item) => escapeHtml(title_case_token_js(item.type || "")) },
    { label: "Description", render: (item) => escapeHtml(sanitizePublicProse(item.description || "").slice(0, 120)) },
    { label: "Members", render: (item) => String((item.memberIds || []).length) },
  ];
  return dataTable({ caption: "Public organizations in the Active Inference Institute governance registry.", columns, rows });
}

function governanceMembersTable(rows = entityPeopleRows()) {
  const columns = [
    { label: "Name", render: (item) => escapeHtml(item.name) },
    { label: "Title", render: (item) => escapeHtml(item.title || "") },
    { label: "Roles", render: (item) => escapeHtml((item.roles || []).join(" · ")) },
    { label: "Active", render: (item) => (item.active ? "Yes" : "No") },
  ];
  return dataTable({ caption: "Public governance members in the Active Inference Institute registry.", columns, rows });
}

function processesTable(rows = processRows()) {
  const columns = [
    { label: "Process", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.title)}</a>` },
    { label: "Category", render: (item) => escapeHtml(title_case_token_js(item.category || "")) },
    { label: "Status", render: (item) => escapeHtml(title_case_token_js(item.status || "")) },
    { label: "Steps", render: (item) => String(item.stepCount || 0) },
    { label: "SLA days", render: (item) => item.slaDays != null ? String(item.slaDays) : "—" },
    { label: "Description", render: (item) => escapeHtml(sanitizePublicProse(item.description || "").slice(0, 120)) },
  ];
  return dataTable({ caption: "Public governance process descriptions from the Active Inference Institute.", columns, rows });
}

function publicationsTable(rows = communicationRows()) {
  const columns = [
    { label: "Title", render: (item) => escapeHtml(item.title) },
    { label: "Type", render: (item) => escapeHtml(title_case_token_js(item.type || "")) },
    { label: "Date", render: (item) => escapeHtml((item.date || "").slice(0, 10)) },
    { label: "Author", render: (item) => escapeHtml(item.author || "") },
    { label: "Reference", render: (item) => escapeHtml(item.referenceNumber || "") },
  ];
  return dataTable({ caption: "Approved public communications from the Active Inference Institute.", columns, rows });
}

function policiesTable(rows = policyRows()) {
  const columns = [
    { label: "Policy", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.title)}</a>` },
    { label: "Category", render: (item) => escapeHtml(title_case_token_js((item.category || "").replace(/_/g, " "))) },
    { label: "Status", render: (item) => escapeHtml(title_case_token_js(item.status || "")) },
    { label: "Version", render: (item) => escapeHtml(item.currentVersion || "") },
    { label: "Description", render: (item) => escapeHtml(sanitizePublicProse(item.description || "").slice(0, 120)) },
    { label: "Tags", render: (item) => escapeHtml(listText(item.tags)) },
  ];
  return dataTable({ caption: "Public governance policy registry for the Active Inference Institute.", columns, rows });
}

function title_case_token_js(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function knowledgePreview(page, currentDir = "") {
  const previewConfig = {
    about: {
      eyebrow: "Public GitHub people",
      title: "Visible public contributors",
      text: "A compact view of externally visible GitHub profiles connected to public Institute repositories.",
      table: peopleTable(peopleRows(6)),
      anchor: "people-table",
    },
    projects: {
      eyebrow: "Public repositories",
      title: "Open-source project registry",
      text: "Repository rows preserve public language, stars, update recency, project family, and documentation links.",
      table: projectsTable(projectRows(8)),
      anchor: "projects-table",
    },
    learning: {
      eyebrow: "Ideas and methods",
      title: "Concepts and methods from the learning graph",
      text: "A compact selection from the Active Inference and Free Energy Principle tech-tree nodes.",
      table: ideasTable(ideaRows(8)),
      anchor: "ideas-table",
    },
    ecosystem: {
      eyebrow: "Ontology relationships",
      title: "Relationships across the conceptual graph",
      text: "A compact relationship view showing how ideas, methods, values, and tools connect.",
      table: ontologyTable(ontologyRows(8)),
      anchor: "ontology-table",
    },
  }[page.slug];
  if (!previewConfig) {
    return "";
  }
  return `<section class="content-band knowledge-preview-band" id="knowledge-preview">
    ${sectionHeading({ eyebrow: previewConfig.eyebrow, title: previewConfig.title, text: previewConfig.text })}
    ${previewConfig.table}
    <p class="section-link"><a href="${hrefForSlug("knowledge", currentDir, previewConfig.anchor)}">Open the full Open Source Map</a></p>
  </section>`;
}

function knowledgePage() {
  const counts = instituteosCounts();
  const darkAsset = brandAsset("dark");
  const currentDir = urlDirForSlug("knowledge");
  const body = `
  <section class="page-hero compact knowledge-hero">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Open Source Map</span></nav>
    <p class="eyebrow">Public open-source map</p>
    <div class="knowledge-hero-layout">
      <div>
        <h1>Open Source Map</h1>
        <p>Structured public tables for externally visible people, public repositories, research links, ideas, and ontology relationships across the Active Inference Institute ecosystem.</p>
        ${actionButtons([
          { label: "Filter resources", href: "resources.html" },
          { label: "Browse repositories", href: "directory.html#repositories" },
          { label: "Start learning", sourceId: "start-docs" },
        ], currentDir)}
      </div>
      ${
        darkAsset
          ? `<img class="knowledge-brand-image" src="${escapeHtml(relPrefix(currentDir) + darkAsset.path)}" alt="${escapeHtml(darkAsset.alt)}">`
          : ""
      }
    </div>
  </section>
  <section class="metrics-band" aria-label="Open Source Map summary">
    <div><strong>${counts.people}</strong><span>public people</span></div>
    <div><strong>${counts.projects}</strong><span>public repositories</span></div>
    <div><strong>${counts.ideas}</strong><span>idea rows</span></div>
    <div><strong>${counts.research}</strong><span>research links</span></div>
    <div><strong>${counts.ontology}</strong><span>relationship rows</span></div>
    <div><strong>${counts.organizations}</strong><span>organizations</span></div>
    <div><strong>${counts.members}</strong><span>governance members</span></div>
    <div><strong>${counts.processes}</strong><span>governance processes</span></div>
    <div><strong>${counts.publications}</strong><span>publications</span></div>
    <div><strong>${counts.policies}</strong><span>policies</span></div>
  </section>
  <section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">On this page</p>
        <h2>Open Source Map guide</h2>
      </div>
      <nav aria-label="Open Source Map sections">
        <a href="#public-data-policy">Public link policy</a>
        <a href="#people-table">People</a>
        <a href="#projects-table">Repositories</a>
        <a href="#ideas-table">Ideas</a>
        <a href="#ontology-table">Ontology</a>
        <a href="#research-table">Research</a>
        <a href="#organizations-table">Organizations</a>
        <a href="#members-table">Governance</a>
        <a href="#processes-table">Processes</a>
        <a href="#publications-table">Publications</a>
        <a href="#policies-table">Policies</a>
        <a href="#related-pages">Related pages</a>
      </nav>
    </div>
  </section>
  <section class="content-band next-action-band" id="next-actions">
    <div class="next-action-panel">
      <div>
        <p class="eyebrow">Best next actions</p>
        <h2>Use the structured map</h2>
        <p>Start with search if you know a contributor, repository, paper, or concept. Use Directory when you need every public link and repository in one place.</p>
      </div>
      ${linkChips([
        { label: "Directory", href: "directory.html#open-source-map" },
        { label: "Projects", href: "projects.html#knowledge-preview" },
        { label: "Learning", href: "learning.html#knowledge-preview" },
        { label: "Repositories", href: "directory.html#repositories" },
        { label: "Ontology shortlink", sourceId: "shortlink-ontology" },
        { label: "START docs", sourceId: "start-docs" },
      ], currentDir)}
    </div>
  </section>
  <section class="content-band" id="public-data-policy">
    ${sectionHeading({
      eyebrow: "Public link policy",
      title: "External-first public data",
      text: "These tables render public GitHub profiles, public repositories, verified research links, and public concept metadata only. Internal operational records and private working details are excluded.",
    })}
    ${cardGrid([
      { title: "People", text: "Externally visible public GitHub profile rows with public repository context.", links: [{ label: "People table", href: "#people-table" }] },
      { title: "Repositories", text: "Public ActiveInferenceInstitute repositories with project family, type, language, stars, and updated date.", links: [{ label: "Repository table", href: "#projects-table" }] },
      { title: "Ideas", text: "Concept, method, tool, value, and publication nodes from public-safe tech-tree metadata.", links: [{ label: "Ideas table", href: "#ideas-table" }] },
      { title: "Ontology", text: "Directed relationships between public ideas, methods, values, tools, and applications.", links: [{ label: "Ontology table", href: "#ontology-table" }] },
      { title: "Research", text: "Verified public research, paper, and reference links from the resource registry.", links: [{ label: "Research table", href: "#research-table" }] },
      { title: "Organizations", text: "Public organizations in the governance registry — governing bodies, internal units, partners, and technology providers.", links: [{ label: "Organizations table", href: "#organizations-table" }] },
      { title: "Governance", text: "Public governance members including board, officers, and registered organizational roles.", links: [{ label: "Governance table", href: "#members-table" }] },
      { title: "Processes", text: "Public governance process descriptions including category, status, step count, and SLA.", links: [{ label: "Processes table", href: "#processes-table" }] },
      { title: "Publications", text: "Approved public communications including reports, announcements, and newsletters.", links: [{ label: "Publications table", href: "#publications-table" }] },
      { title: "Policies", text: "Public governance policy registry with category, status, version, and description.", links: [{ label: "Policies table", href: "#policies-table" }] },
    ], currentDir)}
  </section>
  <section class="content-band page-index-band">
    <div class="knowledge-tools" aria-label="Open Source Map filters">
      <label>
        <span>Search Open Source Map</span>
        <input id="knowledge-search" type="search" placeholder="Search people, repositories, papers, ideas, relationships">
      </label>
      <label>
        <span>Table</span>
        <select id="knowledge-kind">
          <option value="">All tables</option>
          <option value="people">People</option>
          <option value="projects">Repositories</option>
          <option value="ideas">Ideas</option>
          <option value="ontology">Ontology</option>
          <option value="research">Research</option>
          <option value="organizations">Organizations</option>
          <option value="members">Governance</option>
          <option value="processes">Processes</option>
          <option value="publications">Publications</option>
          <option value="policies">Policies</option>
        </select>
      </label>
      <p id="knowledge-count" class="result-count" aria-live="polite">${counts.people + counts.projects + counts.ideas + counts.ontology + counts.research + counts.organizations + counts.members + counts.processes + counts.publications + counts.policies} rows shown</p>
    </div>
  </section>
  ${tableSection({
    id: "people-table",
    eyebrow: "People",
    title: `${counts.people} public people rows`,
    text: "Public GitHub profiles visible through public ActiveInferenceInstitute repository metadata.",
    countLabel: `${counts.people} people shown`,
    tableHtml: peopleTable(),
  })}
  ${tableSection({
    id: "projects-table",
    eyebrow: "Repositories",
    title: `${counts.projects} public repository rows`,
    text: "Open-source project rows derived from the public ActiveInferenceInstitute GitHub namespace.",
    countLabel: `${counts.projects} repositories shown`,
    tableHtml: projectsTable(),
  })}
  ${tableSection({
    id: "ideas-table",
    eyebrow: "Ideas",
    title: `${counts.ideas} idea rows`,
    text: "Deduplicated concepts, methods, tools, values, and applications from the public-safe concept graph.",
    countLabel: `${counts.ideas} ideas shown`,
    tableHtml: ideasTable(),
  })}
  ${ontologyGraphSection(currentDir)}
  ${tableSection({
    id: "ontology-table",
    eyebrow: "Ontology",
    title: `${counts.ontology} relationship rows`,
    text: "Directed relationships from the Active Inference and Free Energy Principle tech trees.",
    countLabel: `${counts.ontology} relationships shown`,
    tableHtml: ontologyTable(),
  })}
  ${tableSection({
    id: "research-table",
    eyebrow: "Research",
    title: `${counts.research} research and paper rows`,
    text: "Verified public research, paper, and reference links surfaced from the resource registry.",
    countLabel: `${counts.research} research links shown`,
    tableHtml: researchTable(),
  })}
  ${tableSection({
    id: "organizations-table",
    eyebrow: "Organizations",
    title: `${counts.organizations} organization rows`,
    text: "Public organizations in the governance registry — governing bodies, internal units, partners, and technology providers.",
    countLabel: `${counts.organizations} organizations shown`,
    tableHtml: organizationsTable(),
  })}
  ${tableSection({
    id: "members-table",
    eyebrow: "Governance",
    title: `${counts.members} governance member rows`,
    text: "Public governance members including board, officers, and registered organizational roles.",
    countLabel: `${counts.members} governance members shown`,
    tableHtml: governanceMembersTable(),
  })}
  ${tableSection({
    id: "processes-table",
    eyebrow: "Processes",
    title: `${counts.processes} governance process rows`,
    text: "Public governance process descriptions with category, status, step count, and SLA target.",
    countLabel: `${counts.processes} processes shown`,
    tableHtml: processesTable(),
  })}
  ${tableSection({
    id: "publications-table",
    eyebrow: "Publications",
    title: `${counts.publications} publication rows`,
    text: "Approved public communications — reports, announcements, and newsletters.",
    countLabel: `${counts.publications} publications shown`,
    tableHtml: publicationsTable(),
  })}
  ${tableSection({
    id: "policies-table",
    eyebrow: "Policies",
    title: `${counts.policies} governance policy rows`,
    text: "Public governance policy registry with category, current status, version, and description.",
    countLabel: `${counts.policies} policies shown`,
    tableHtml: policiesTable(),
  })}
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the public site" })}
    ${cardGrid([
      { title: "About", text: "Institutional orientation and public visitor pathways.", links: [{ label: "About the Institute", href: "about.html" }] },
      { title: "Projects", text: "Public project, repository, and applied-work pathways.", links: [{ label: "Project map", href: "projects.html" }] },
      { title: "Learning", text: "Learning paths, research references, and concept orientation.", links: [{ label: "Learning and Research", href: "learning.html" }] },
      { title: "Directory", text: "Every rendered public page, resource group, official link, repository, and table row.", links: [{ label: "Global Directory", href: "directory.html" }] },
    ], currentDir)}
  </section>`;
  return layout({
    title: "Open Source Map",
    description: "Structured public tables for ActiveInferenceInstitute people, repositories, research links, ideas, and ontology relationships.",
    currentDir,
    body,
  });
}

function knowledgeDirectoryRows(currentDir = "") {
  const rows = [
    ...siteData.instituteos.people.records.map((item) => ({
      kind: "Public People",
      label: item.name,
      summary: `${item.publicRole}: @${item.login}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("person", item.id)),
    })),
    ...siteData.instituteos.projects.records.map((item) => ({
      kind: "Repositories",
      label: item.title,
      summary: `${item.projectFamily} / ${item.language || "Unspecified"}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("project", item.id)),
    })),
    ...siteData.instituteos.ideas.records.map((item) => ({
      kind: "Ideas and Methods",
      label: item.label,
      summary: `${title_case_token_js(item.nodeType)} / ${item.maturity}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("idea", item.id)),
    })),
    ...siteData.instituteos.ontology.edges.map((item) => ({
      kind: "Ontology",
      label: `${item.sourceLabel} -> ${item.targetLabel}`,
      summary: `${item.treeTitle} / ${item.relationship}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("ontology", item.id)),
    })),
    ...researchRows().map((item) => ({
      kind: "Research and Papers",
      label: item.label,
      summary: `${item.categoryLabel} / ${item.audienceLabel}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("research", item.sourceId)),
    })),
    ...(siteData.instituteos.entities.organizations || []).map((item) => ({
      kind: "Organizations",
      label: item.name,
      summary: `${title_case_token_js(item.type || "")}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("org", item.id)),
    })),
    ...(siteData.instituteos.entities.people || []).map((item) => ({
      kind: "Governance Members",
      label: item.name,
      summary: `${item.title || ""} ${(item.roles || []).slice(0, 2).join(", ")}`.trim(),
      href: hrefForSlug("knowledge", currentDir, rowAnchor("member", item.id)),
    })),
    ...(siteData.instituteos.processes.records || []).map((item) => ({
      kind: "Governance Processes",
      label: item.title,
      summary: `${title_case_token_js(item.category || "")} / ${title_case_token_js(item.status || "")}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("process", item.id)),
    })),
    ...(siteData.instituteos.communications.records || []).map((item) => ({
      kind: "Publications",
      label: item.title,
      summary: `${title_case_token_js(item.type || "")} / ${(item.date || "").slice(0, 10)}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("publication", item.id)),
    })),
    ...(siteData.instituteos.policies.records || []).map((item) => ({
      kind: "Governance Policies",
      label: item.title,
      summary: `${title_case_token_js((item.category || "").replace(/_/g, " "))} / ${title_case_token_js(item.status || "")}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("policy", item.id)),
    })),
  ];
  return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}

function homePage() {
  const currentDir = urlDirForSlug("index");
  const programPage = siteData.pages.find((page) => page.slug === "programs");
  const projectPage = siteData.pages.find((page) => page.slug === "projects");
  const learningPage = siteData.pages.find((page) => page.slug === "learning");
  const ecosystemPage = siteData.pages.find((page) => page.slug === "ecosystem");
  const featuredResources = uniqueEntries(allResourceEntries().filter((resource) => resource.featured || resource.priority <= 12)).slice(0, 12);
  const body = `
  <section class="hero">
    <div class="hero-inner">
      <p class="eyebrow">Comprehensive public resource hub</p>
      <h1>${escapeHtml(siteData.site.name)}</h1>
      <p class="hero-copy">${escapeHtml(siteData.site.description)}</p>
      ${actionButtons([
        { label: "Open global directory", href: "directory.html" },
        { label: "Browse resources", href: "resources.html" },
        { label: "Explore projects", href: "projects.html" },
      ], currentDir)}
    </div>
  </section>

  <section class="metrics-band" aria-label="Institute summary">
    ${siteData.metrics
      .map((metric) => `<div><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`)
      .join("")}
  </section>

  <section class="content-band">
    ${sectionHeading({
      eyebrow: "Start here",
      title: "Find the right path through the Institute",
      text: "The site indexes official Institute pages, public subdomains, learning and research references, channels, repositories, and participation routes.",
    })}
    <div class="feature-layout">
      <article>
        <h3>Education, research, training, and applications</h3>
        <p>AII supports the Active Inference ecosystem through learning groups, research projects, open-source work, media production, public events, partnerships, and public collaboration pathways.</p>
        <p>Use the directory when you need the complete map, or use the curated pages when you want guided pathways.</p>
      </article>
      <aside class="action-panel" aria-label="Recommended entry points">
        <a href="${hrefForSlug("directory", currentDir)}"><strong>Global index</strong><span>Every page, resource, official link, and repository</span></a>
        <a href="${hrefForSlug("resources", currentDir)}"><strong>Filter resources</strong><span>Search by type, category, audience, and tag</span></a>
        <a href="${hrefForSlug("knowledge", currentDir)}"><strong>Open Source Map</strong><span>Public people, repositories, research, ideas, and ontology tables</span></a>
        <a href="${hrefForSlug("get-involved", currentDir)}"><strong>Participate</strong><span>Channels, activities, support, and contact</span></a>
      </aside>
    </div>
  </section>

  ${audiencePathwaySection(currentDir)}

  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Core areas", title: "How the public work is organized" })}
    ${cardGrid([
      { title: "Institute", text: "Mission, structure, communications, values, public channels, and visitor pathways.", links: [{ label: "About", href: "about.html" }, { label: "Official pages", href: "directory.html#official-pages" }] },
      { title: "Programs", text: programPage.lede, links: [{ label: "Programs", href: "programs.html" }] },
      { title: "Projects", text: projectPage.lede, links: [{ label: "Projects", href: "projects.html" }, { label: "Repositories", href: "directory.html#repositories" }] },
      { title: "Learning", text: learningPage.lede, links: [{ label: "Learning", href: "learning.html" }, { label: "Learning resources", href: "resources.html#learning" }] },
      { title: "Ecosystem", text: ecosystemPage.lede, links: [{ label: "Ecosystem", href: "ecosystem.html" }] },
      { title: "Open Source Map", text: "Structured public tables for people, repositories, research links, ideas, and ontology relationships.", links: [{ label: "Open Source Map", href: "knowledge.html" }] },
      { title: "Directory", text: "A complete global index of public pages, resource groups, repositories, and verified external links.", links: [{ label: "Global directory", href: "directory.html" }] },
    ], currentDir)}
  </section>

  <section class="content-band">
    ${sectionHeading({ eyebrow: "Featured resources", title: "Verified public entry points", text: "These resources are checked through the public link registry and grouped by visitor need." })}
    ${resourceCards(featuredResources, { filterable: false, currentDir })}
  </section>`;
  return layout({
    title: siteData.site.name,
    currentDir,
    description: siteData.site.description,
    body,
    bodyClass: "home",
  });
}

function publicPage(page) {
  const currentDir = urlDirForSlug(page.slug);
  const curated = normalizedCuratedResources();
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const body = `
  <section class="page-hero compact">
    ${breadcrumb(page, currentDir)}
    <p class="eyebrow">${escapeHtml(page.audience || "Public guide")}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.subtitle)}</p>
    ${actionButtons(page.primaryActions, currentDir)}
  </section>
  ${pageGuide(page, currentDir)}
  ${bestNextActions(page, currentDir)}
  <section class="content-band">
    <p class="lede">${escapeHtml(page.lede)}</p>
    <div class="article-stack">
      ${page.sections
        .map((section) => {
          const links = linkChips(section.links, currentDir);
          return `<article class="article-block" id="${escapeHtml(slugifyAnchor(section.heading))}">
            <h2>${escapeHtml(section.heading)}</h2>
            <p>${escapeHtml(section.body)}</p>${links ? `\n            ${links}` : ""}
          </article>`;
        })
        .join("")}
    </div>
  </section>
  ${instituteosFeatureSections(page, currentDir)}
  <section class="content-band muted" id="key-surfaces">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards, currentDir)}
  </section>
  ${page.slug.startsWith("project-") ? relatedProjectsSection(page, currentDir) : ""}
  ${knowledgePreview(page, currentDir)}
  <section class="content-band" id="resources">
    ${sectionHeading({ eyebrow: "Related resources", title: "Public links for this page", text: "External links are resolved from the shared registry so visitor-facing destinations stay centralized and checkable." })}
    ${resourceCards(entriesForPage(page, curated, 12), { currentDir })}
  </section>
  <section class="content-band muted" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute surfaces" })}
    ${resourceCards(entriesForPage(page, official, 8), { compact: true, currentDir })}
  </section>
  <section class="content-band" id="repositories">
    ${sectionHeading({ eyebrow: "Repositories", title: "Related open-source repositories" })}
    ${resourceCards(entriesForPage(page, repositories, page.slug === "projects" ? 16 : 8), { compact: true, currentDir })}
    <p class="section-link"><a href="${hrefForSlug("directory", currentDir, "repositories")}">View all ${siteData.repositories.repositories.length} public repositories</a></p>
  </section>
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the site" })}
    ${relatedPages(page, currentDir)}
  </section>
  ${publicPagePager(page, currentDir)}`;
  return layout({
    title: page.title,
    description: page.lede,
    currentDir,
    body,
  });
}

// ── InstituteOS feature sections (graphs, narratives, domains, related projects) ──

// Narrative entries sanitized and grouped for a given target page. Bodies are
// transposed public Institute prose; markdown/links/PII are scrubbed at render.
function narrativesForTarget(targetPage) {
  return (siteData.instituteos.narratives.narratives || [])
    .filter((entry) => entry.target_page === targetPage)
    .map((entry) => ({
      section: entry.section,
      title: sanitizePublicProse(entry.title || entry.section || ""),
      paragraphs: proseParagraphs(entry.body || ""),
    }))
    .filter((entry) => entry.paragraphs.length > 0);
}

// Render a narrative collection as one content-band with stacked prose blocks.
function narrativeSection({ id, eyebrow, title, text, targetPage }) {
  const entries = narrativesForTarget(targetPage);
  if (!entries.length) {
    return "";
  }
  const blocks = entries
    .map((entry) => {
      const paras = entry.paragraphs.map((para) => `<p>${escapeHtml(para)}</p>`).join("\n            ");
      return `<article class="article-block" id="${escapeHtml(slugifyAnchor(`narrative-${entry.section}-${entry.title}`))}">
            <h3>${escapeHtml(entry.title)}</h3>
            ${paras}
          </article>`;
    })
    .join("\n          ");
  return `<section class="content-band" id="${escapeHtml(id)}">
    ${sectionHeading({ eyebrow, title, text })}
    <div class="article-stack">
          ${blocks}
    </div>
  </section>`;
}

// Tech-tree explorer: an interactive node-link graph plus a relation legend.
function techTreeExplorerSection(currentDir = "") {
  const graph = siteData.instituteos.techTreeGraph;
  return `<section class="content-band" id="tech-tree-explorer">
    ${sectionHeading({
      eyebrow: "Tech-tree explorer",
      title: "Explore the Active Inference learning graph",
      text: "An interactive map of concepts, methods, and tools across the Active Inference and Free Energy Principle tech trees. Select a node to highlight its neighbors; filter by relationship type.",
    })}
    ${graphFigure("tech-tree", graph, currentDir)}
    <p class="section-link"><a href="${hrefForSlug("knowledge", currentDir, "ideas-table")}">Open the full idea and ontology tables</a></p>
  </section>`;
}

// Ontology graph view for the knowledge page (companion to the ontology table).
function ontologyGraphSection(currentDir = "") {
  const graph = siteData.instituteos.ontologyGraph;
  return `<section class="content-band" id="ontology-graph">
    ${sectionHeading({
      eyebrow: "Graph view",
      title: "Ontology relationships as a graph",
      text: "The same public ontology relationships shown in the table below, rendered as an interactive node-link graph. Select a concept to highlight what it connects to.",
    })}
    ${graphFigure("ontology", graph, currentDir)}
    <p class="section-link"><a href="#ontology-table">Jump to the ontology relationship table</a></p>
  </section>`;
}

// Governance network graph for the structure page (entities, policies, processes).
function governanceGraphSection(currentDir = "") {
  const graph = siteData.instituteos.governanceGraph;
  return `<section class="content-band" id="governance-graph">
    ${sectionHeading({
      eyebrow: "Governance network",
      title: "How entities, policies, and processes connect",
      text: "A public-safe network of governance entities, policies, and processes with their RACI-style relationships. Select a node to trace its accountable, responsible, consulted, and informed links.",
    })}
    ${graphFigure("governance", graph, currentDir)}
    <p class="section-link"><a href="${hrefForSlug("knowledge", currentDir, "policies-table")}">Open the full governance registry tables</a></p>
  </section>`;
}

// "Browse projects by domain" — cross-links each domain's projects to the
// generated project pages (where a public page exists for that project).
function domainProjectsSection(currentDir = "") {
  const domains = (siteData.instituteos.domainProjects.domains || []).filter((domain) => (domain.projects || []).length);
  if (!domains.length) {
    return "";
  }
  const slugToPage = new Set(siteData.pages.map((page) => page.slug));
  const cards = domains
    .map((domain) => {
      const links = (domain.projects || [])
        .map((project) => {
          const pageSlug = projectPageSlugForDataId(project.id);
          const label = escapeHtml(sanitizePublicProse(project.title || project.id));
          if (pageSlug && slugToPage.has(pageSlug)) {
            return `<a href="${slugToHref(pageSlug, currentDir)}">${label}</a>`;
          }
          return `<span>${label}</span>`;
        })
        .join("");
      return `<article class="info-card domain-card" id="${escapeHtml(slugifyAnchor(`domain-${domain.slug}`))}">
        <h3>${escapeHtml(sanitizePublicProse(domain.domain))}</h3>
        <p>${(domain.projects || []).length} public project${(domain.projects || []).length === 1 ? "" : "s"} mapped to this domain of application.</p>
        <div class="mini-links">${links}</div>
      </article>`;
    })
    .join("");
  return `<section class="content-band" id="browse-by-domain">
    ${sectionHeading({
      eyebrow: "Browse by domain",
      title: "Projects across domains of application",
      text: "Each domain of application links to the public project pages that work within it. Projects can appear in more than one domain.",
    })}
    <div class="card-grid">${cards}</div>
  </section>`;
}

// Map a data/projects.json project id to its generated page slug. Prefers the
// explicit website_slug; falls back to the conventional project-<id> form when a
// page exists.
const projectDataById = new Map((loadProjectsData().projects || []).map((project) => [project.id, project]));
function projectPageSlugForDataId(dataId) {
  const project = projectDataById.get(dataId);
  if (project && project.website_slug) {
    return project.website_slug;
  }
  return `project-${dataId}`;
}

// "Related projects" for a project page: projects sharing category and/or
// topics, ranked by overlap, restricted to those with a real public page.
function relatedProjectsForPage(page) {
  const slug = page.slug;
  const projects = (loadProjectsData().projects || []).filter((project) => project.website_slug);
  const self = projects.find((project) => project.website_slug === slug);
  if (!self) {
    return [];
  }
  const selfTopics = new Set((self.topics || []).map((topic) => String(topic).toLowerCase()));
  const scored = projects
    .filter((project) => project.website_slug !== slug)
    .map((project) => {
      const topics = (project.topics || []).map((topic) => String(topic).toLowerCase());
      const shared = topics.filter((topic) => selfTopics.has(topic));
      const categoryMatch = project.category && self.category && project.category === self.category ? 1 : 0;
      const score = shared.length * 2 + categoryMatch;
      return { project, score, sharedCount: shared.length, sharedTopics: shared.slice(0, 3) };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.project.title.localeCompare(b.project.title),
    )
    .slice(0, 6);
  return scored;
}

function relatedProjectsSection(page, currentDir = "") {
  const related = relatedProjectsForPage(page);
  if (!related.length) {
    return "";
  }
  const slugToPage = new Set(siteData.pages.map((candidate) => candidate.slug));
  const cards = related
    .filter((entry) => slugToPage.has(entry.project.website_slug))
    .map((entry) => {
      const project = entry.project;
      const reason = entry.sharedTopics.length
        ? `Shared topics: ${entry.sharedTopics.map((topic) => title_case_token_js(topic)).join(", ")}`
        : `Same category: ${title_case_token_js(project.category || "")}`;
      const summary = sanitizePublicProse(project.summary || project.description || "").slice(0, 160);
      return `<a class="resource-card internal-card related-project-card" href="${slugToHref(project.website_slug, currentDir)}">
        <span>${escapeHtml(title_case_token_js(project.category || "Project"))}</span>
        <strong>${escapeHtml(sanitizePublicProse(project.title))}</strong>
        <p>${escapeHtml(summary)}</p>
        <em>${escapeHtml(reason)}</em>
      </a>`;
    })
    .join("");
  if (!cards) {
    return "";
  }
  return `<section class="content-band muted" id="related-projects">
    ${sectionHeading({
      eyebrow: "Related projects",
      title: "Projects with shared topics",
      text: "Computed from shared topics and category in the public project data feed.",
    })}
    <div class="resource-grid compact-grid">${cards}</div>
  </section>`;
}

// InstituteOS feature blocks injected into a curated public page, keyed by slug.
// Returns markup inserted between the article stack and the key-surfaces band so
// the required curated section ordering stays intact.
function instituteosFeatureSections(page, currentDir = "") {
  switch (page.slug) {
    case "learning":
      return techTreeExplorerSection(currentDir);
    case "structure":
      return (
        governanceGraphSection(currentDir) +
        narrativeSection({
          id: "structure-narratives",
          eyebrow: "Institute structure",
          title: "How the Institute is organized",
          text: "Public narrative content describing how the Institute is structured and organized.",
          targetPage: "structure",
        })
      );
    case "ecosystem":
      return (
        domainProjectsSection(currentDir) +
        narrativeSection({
          id: "ecosystem-narratives",
          eyebrow: "Ecosystem",
          title: "The Active Inference ecosystem",
          text: "Public narrative content describing the ecosystem and its domains of application.",
          targetPage: "ecosystem",
        })
      );
    case "about":
      return narrativeSection({
        id: "about-narratives",
        eyebrow: "Institute narrative",
        title: "Mission, history, and direction",
        text: "Public mission, vision, values, history, strategy, and focus-area prose for the Institute.",
        targetPage: "about",
      });
    case "activities":
      return narrativeSection({
        id: "activities-narratives",
        eyebrow: "Activities",
        title: "Public activities and updates",
        text: "Public narrative content describing the Institute's recurring activities.",
        targetPage: "activities",
      });
    default:
      return "";
  }
}

function optionList(items) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
}

function resourcesPage() {
  const currentDir = urlDirForSlug("resources");
  const categories = siteData.resources.categories || [];
  const types = siteData.resources.types || [];
  const audiences = siteData.resources.audiences || [];
  const resources = allResourceEntries();
  const curated = normalizedCuratedResources();
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const shortlinks = official.filter((resource) => resource.shortlink);
  const popularTags = siteData.resources.popularTags || [...new Set(resources.flatMap((resource) => resource.tags || []))].sort().slice(0, 16);
  const tagOptions = popularTags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("");
  const tagButtons = popularTags
    .map((tag) => `<button type="button" data-tag-filter="${escapeHtml(tag)}" aria-pressed="false">${escapeHtml(tag)}</button>`)
    .join("");
  const featured = uniqueEntries(resources.filter((resource) => resource.featured || resource.priority <= 16)).slice(0, 16);
  const learningResearch = resources
    .filter((resource) => ["learning", "research", "tools"].includes(resource.category) || ["learner", "researcher"].includes(resource.audience))
    .slice(0, 24);
  const participation = resources
    .filter((resource) => ["community", "participation", "support", "social"].includes(resource.category) || ["contributor", "supporter"].includes(resource.audience))
    .slice(0, 24);
  const categoryNav = categories
    .map((category) => {
      const count = resources.filter((resource) => resource.category === category.id).length;
      return `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.label)} <span>${count}</span></a>`;
    })
    .join("");
  const grouped = categories
    .map((category) => {
      const groupResources = resources.filter((resource) => resource.category === category.id);
      return `<section class="resource-category" id="${escapeHtml(category.id)}">
        ${sectionHeading({ eyebrow: "Resource group", title: category.label, text: category.description })}
        <p class="category-count" data-category-count="${escapeHtml(category.id)}">${groupResources.length} resources in this group</p>
        ${resourceCards(groupResources, { currentDir })}
      </section>`;
    })
    .join("");
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Resources</span></nav>
    <p class="eyebrow">Searchable directory</p>
    <h1>Resources</h1>
    <p>Find verified public links for official pages, community, learning, media, projects, research, support, social channels, and repositories.</p>
  </section>
  <section class="content-band" id="resource-views">
    ${sectionHeading({ eyebrow: "Resource views", title: "Use the directory by intent", text: "Start with a focused view, then use the full directory when you need precise filtering across every rendered resource." })}
    ${cardGrid([
      { title: `Featured (${featured.length})`, text: "High-signal public entry points for first-time visitors and frequent contributors.", links: [{ label: "Open featured", href: "#featured" }] },
      { title: `Official pages (${official.length})`, text: "Reachable official Institute pages, domains, programs, and public subdomains.", links: [{ label: "Open official pages", href: "#official-pages" }] },
      { title: `Repositories (${repositories.length})`, text: "All reachable public ActiveInferenceInstitute repositories with metadata and sort controls.", links: [{ label: "Open repositories", href: "#repositories-view" }] },
      { title: `Learning / Research (${learningResearch.length})`, text: "START, education, textbook, research, ontology, and technical learning references.", links: [{ label: "Open learning and research", href: "#learning-research" }] },
      { title: `Participation (${participation.length})`, text: "Community, contribution, mentorship, volunteer, support, and social routes.", links: [{ label: "Open participation", href: "#participation-view" }] },
      { title: "Open Source Map", text: "Structured tables for public people, repositories, research links, ideas, and ontology relationships.", links: [{ label: "Open Source Map", href: "knowledge.html" }] },
      { title: `Full directory (${resources.length})`, text: "Search and filter every rendered resource by type, group, audience, and popular tags.", links: [{ label: "Open full directory", href: "#full-directory" }] },
    ], currentDir)}
  </section>
  <section class="content-band muted" id="featured">
    ${sectionHeading({ eyebrow: "Featured", title: "High-signal public entry points" })}
    ${resourceCards(featured, { filterable: false, currentDir })}
  </section>
  <section class="content-band" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute web surfaces", text: "These are official pages, subdomains, and public program surfaces that resolve through the verified live-source registry." })}
    ${resourceCards(official, { compact: true, filterable: false, currentDir })}
  </section>
  <section class="content-band muted" id="official-shortlinks">
    ${sectionHeading({ eyebrow: "Official shortlinks", title: "Compact public subdomain map", text: "Shortlinks route visitors into official program, learning, preparation, project, and knowledge-base spaces." })}
    ${resourceCards(shortlinks, { compact: true, filterable: false, currentDir })}
  </section>
  <section class="content-band" id="repositories-view">
    ${sectionHeading({ eyebrow: "Repositories", title: "Public GitHub repositories", text: "Sort the public repository view without external scripts or runtime services." })}
    <div class="section-controls">
      <label>
        <span>Sort repositories</span>
        <select id="repo-sort">
          <option value="updated">Recently updated</option>
          <option value="stars">Most starred</option>
          <option value="language">Language</option>
          <option value="category">Group</option>
        </select>
      </label>
      <p>${repositories.length} public repositories indexed</p>
    </div>
    ${resourceCards(repositories, { compact: true, filterable: false, sortable: true, wrapperAttrs: ' id="repository-list" data-repository-list', currentDir })}
  </section>
  <section class="content-band muted" id="learning-research">
    ${sectionHeading({ eyebrow: "Learning / Research", title: "Study, research, and technical reference pathways" })}
    ${resourceCards(learningResearch, { filterable: false, currentDir })}
  </section>
  <section class="content-band" id="participation-view">
    ${sectionHeading({ eyebrow: "Participation", title: "Community, contribution, and support pathways" })}
    ${resourceCards(participation, { filterable: false, currentDir })}
  </section>
  <section class="content-band muted" id="full-directory">
    ${sectionHeading({ eyebrow: "Full directory", title: "Search and filter every rendered resource" })}
  <section class="content-band page-index-band">
    <div class="resource-tools" aria-label="Resource filters">
      <label>
        <span>Search resources</span>
        <input id="resource-search" type="search" placeholder="Search Discord, repositories, courses, research, support">
      </label>
      <label>
        <span>Type</span>
        <select id="resource-type">
          <option value="">All types</option>
          ${optionList(types)}
        </select>
      </label>
      <label>
        <span>Group</span>
        <select id="resource-category">
          <option value="">All groups</option>
          ${optionList(categories)}
        </select>
      </label>
      <label>
        <span>Audience</span>
        <select id="resource-audience">
          <option value="">All audiences</option>
          ${optionList(audiences)}
        </select>
      </label>
      <label>
        <span>Popular tag</span>
        <select id="resource-tag">
          <option value="">All popular tags</option>
          ${tagOptions}
        </select>
      </label>
      <p id="resource-count" class="result-count" aria-live="polite">${resources.length} resources shown</p>
    </div>
    <div class="tag-filter-chips" aria-label="Popular tag filters">
      <button type="button" data-tag-filter="" aria-pressed="true">All tags</button>
      ${tagButtons}
    </div>
    <nav class="category-nav" aria-label="Resource groups">${categoryNav}</nav>
  </section>
  <section class="content-band">
    ${grouped}
  </section>
  </section>`;
  return layout({
    title: "Resources",
    description: "Searchable directory of verified public Active Inference Institute resources.",
    currentDir,
    body,
  });
}

function directoryPage() {
  const currentDir = urlDirForSlug("directory");
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const resources = allResourceEntries();
  const publicPages = siteData.pages;
  const shortlinks = official.filter((item) => item.shortlink);
  const knowledgeRows = knowledgeDirectoryRows(currentDir);
  const officialColumns = [
    { label: "Official page", render: (item) => `<a href="${escapeHtml(item.href)}"${linkAttrs(item.href)}>${escapeHtml(item.label)}</a>` },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Audience", render: (item) => escapeHtml(item.audienceLabel) },
    { label: "Related", render: (item) => (item.relatedSlugs || []).map((slug) => pageBySlug.get(slug)).filter(Boolean).map((page) => `<a href="${slugToHref(page.slug, currentDir)}">${escapeHtml(page.title)}</a>`).join(" ") },
  ];
  const repoColumns = [
    { label: "Repository", render: (item) => `<a href="${escapeHtml(item.href)}"${linkAttrs(item.href)}>${escapeHtml(item.label)}</a>` },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Language", render: (item) => escapeHtml(item.language || "Unspecified") },
    { label: "Stars", render: (item) => String(Number(item.stars || 0)) },
    { label: "Updated", render: (item) => escapeHtml((item.updatedAt || "").slice(0, 10)) },
  ];
  const linkColumns = [
    { label: "Link", render: (item) => `<a href="${escapeHtml(item.href)}"${linkAttrs(item.href)}>${escapeHtml(item.label)}</a>` },
    { label: "Type", render: (item) => escapeHtml(item.typeLabel) },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Audience", render: (item) => escapeHtml(item.audienceLabel) },
  ];
  const knowledgeColumns = [
    { label: "Table row", render: (item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` },
    { label: "Table", render: (item) => escapeHtml(item.kind) },
    { label: "Summary", render: (item) => escapeHtml(item.summary) },
  ];
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Directory</span></nav>
    <p class="eyebrow">Global index</p>
    <h1>Directory</h1>
    <p>Every public page, section, resource group, verified external link, official page, and public repository indexed by this site.</p>
    ${actionButtons([{ label: "Filter resources", href: "resources.html" }, { label: "Open Source Map", href: "knowledge.html" }, { label: "Project map", href: "projects.html" }], currentDir)}
  </section>
  <section class="metrics-band" aria-label="Directory summary">
    <div><strong>${publicPages.length}</strong><span>curated public pages</span></div>
    <div><strong>${resources.length}</strong><span>rendered verified resources</span></div>
    <div><strong>${official.length}</strong><span>official public pages</span></div>
    <div><strong>${shortlinks.length}</strong><span>official shortlinks</span></div>
    <div><strong>${repositories.length}</strong><span>public repositories</span></div>
    <div><strong>${knowledgeRows.length}</strong><span>open-source map rows</span></div>
  </section>
  <section class="content-band" id="site-pages">
    ${sectionHeading({ eyebrow: "Site pages", title: "Curated public pages and sections" })}
    <div class="directory-list">
      ${publicPages
        .map((page) => `<article class="directory-entry">
          <h3><a href="${slugToHref(page.slug, currentDir)}">${escapeHtml(page.title)}</a></h3>
          <p>${escapeHtml(page.lede)}</p>
          <div class="mini-links">${page.sections.map((section) => `<a href="${slugToHref(page.slug, currentDir, slugifyAnchor(section.heading))}">${escapeHtml(section.heading)}</a>`).join("")}</div>
        </article>`)
        .join("")}
    </div>
  </section>
  <section class="content-band muted" id="resource-groups">
    ${sectionHeading({ eyebrow: "Resource groups", title: "Directory groups" })}
    ${cardGrid((siteData.resources.categories || []).map((category) => ({
      title: `${category.label} (${resources.filter((resource) => resource.category === category.id).length})`,
      text: category.description,
      links: [{ label: "Open group", href: `resources.html#${category.id}` }],
    })), currentDir)}
  </section>
  <section class="content-band" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: `${official.length} official Institute surfaces` })}
    ${dataTable({ caption: "Official Institute pages and public destinations.", columns: officialColumns, rows: official })}
  </section>
  <section class="content-band muted" id="official-shortlinks">
    ${sectionHeading({ eyebrow: "Official shortlinks", title: `${shortlinks.length} compact official destinations` })}
    ${dataTable({ caption: "Official public shortlinks.", columns: officialColumns, rows: shortlinks })}
  </section>
  <section class="content-band" id="repositories">
    ${sectionHeading({ eyebrow: "Repositories", title: `${repositories.length} public repositories` })}
    ${dataTable({ caption: "Public ActiveInferenceInstitute repositories.", columns: repoColumns, rows: repositories })}
  </section>
  <section class="content-band muted" id="verified-links">
    ${sectionHeading({ eyebrow: "Verified links", title: "Rendered external link index" })}
    ${dataTable({ caption: "Rendered external links backed by the live source registry.", columns: linkColumns, rows: resources })}
  </section>
  <section class="content-band" id="open-source-map">
    ${sectionHeading({
      eyebrow: "Open Source Map",
      title: `${knowledgeRows.length} structured public rows`,
      text: "Public-safe table rows for GitHub people, repositories, research links, ideas, and ontology relationships.",
    })}
    ${cardGrid([
      { title: `People (${siteData.instituteos.people.records.length})`, text: "Public GitHub profile rows visible through repository metadata.", links: [{ label: "Open people table", href: "knowledge.html#people-table" }] },
      { title: `Repositories (${siteData.instituteos.projects.records.length})`, text: "Public repository rows derived from the ActiveInferenceInstitute GitHub namespace.", links: [{ label: "Open repository table", href: "knowledge.html#projects-table" }] },
      { title: `Ideas (${siteData.instituteos.ideas.records.length})`, text: "Concept, method, tool, value, and application rows from the concept graph.", links: [{ label: "Open ideas table", href: "knowledge.html#ideas-table" }] },
      { title: `Ontology (${siteData.instituteos.ontology.edges.length})`, text: "Directed relationship rows from the concept graph.", links: [{ label: "Open ontology table", href: "knowledge.html#ontology-table" }] },
      { title: `Research (${researchRows().length})`, text: "Verified public research, paper, and reference rows.", links: [{ label: "Open research table", href: "knowledge.html#research-table" }] },
    ], currentDir)}
    ${dataTable({ caption: "Every Open Source Map row anchor.", columns: knowledgeColumns, rows: knowledgeRows })}
  </section>`;
  return layout({
    title: "Directory",
    description: "Global index of public Active Inference Institute pages, resources, official links, and repositories.",
    currentDir,
    body,
  });
}

function communicationsRecords() {
  let data;
  try {
    data = loadJson("instituteos/communications_public.json");
  } catch {
    return [];
  }
  const records = data.records || data.communications || [];
  return records.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function buildRssFeed() {
  const base = absoluteUrl("index.html");
  const updatesUrl = absoluteUrl("activities/index.html");
  const items = communicationsRecords()
    .map((communication) => {
      const title = communication.title || communication.type || "Update";
      const pubDate = new Date(`${communication.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${escapeHtml(updatesUrl)}</link>
      <guid isPermaLink="false">${escapeHtml(`${base}#${communication.id}`)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeHtml(communication.type || "update")}</category>
      <description>${escapeHtml(`${communication.type || "update"}: ${title}`)}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(siteData.site.name)} — Updates</title>
    <link>${escapeHtml(base)}</link>
    <atom:link href="${escapeHtml(absoluteUrl("feed.xml"))}" rel="self" type="application/rss+xml"/>
    <description>${escapeHtml(siteData.site.description)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

function buildJsonFeed() {
  const base = absoluteUrl("index.html");
  const updatesUrl = absoluteUrl("activities/index.html");
  return (
    JSON.stringify(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: `${siteData.site.name} — Updates`,
        home_page_url: base,
        feed_url: absoluteUrl("feed.json"),
        description: siteData.site.description,
        language: "en",
        items: communicationsRecords().map((communication) => ({
          id: `${base}#${communication.id}`,
          title: communication.title || communication.type || "Update",
          content_text: `${communication.type || "update"}: ${communication.title || ""}`.trim(),
          date_published: new Date(`${communication.date}T00:00:00Z`).toISOString(),
          url: updatesUrl,
          tags: communication.type ? [communication.type] : [],
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

function buildManifest() {
  return (
    JSON.stringify(
      {
        name: siteData.site.name,
        short_name: "AII",
        description: siteData.site.description,
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        icons: [
          { src: "assets/img/instituteos/ActInferServe.png", sizes: "357x445", type: "image/png", purpose: "any" },
          { src: "assets/img/instituteos/Dark_ActInfServe.png", sizes: "937x819", type: "image/png", purpose: "any" },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}

function buildSecurityTxt() {
  return [
    `Contact: mailto:${siteData.site.email}`,
    "Expires: 2027-06-19T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${absoluteUrl(".well-known/security.txt")}`,
    "",
  ].join("\n");
}

function writeFile(file, html) {
  ensure(path.dirname(out(file)));
  fs.writeFileSync(out(file), html.replace(/[ \t]+$/gm, ""), "utf8");
}

function build() {
  // Every routed page maps to <dir>/index.html via the clean-URL taxonomy.
  // The home page is the only root index.html; 404.html is the only flat file.
  const slugRenderers = [
    ["index", homePage],
    ...siteData.pages.map((page) => [page.slug, () => publicPage(page)]),
    ["knowledge", knowledgePage],
    ["resources", resourcesPage],
    ["directory", directoryPage],
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
      body: `<section class="page-hero compact"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", "")}">Home</a><span aria-hidden="true">/</span><span>404</span></nav><p class="eyebrow">404</p><h1>Page not found</h1><p>Use the navigation, resource directory, or global index to return to the Institute website.</p><a class="button primary" href="${hrefForSlug("index", "")}">Home</a></section>`,
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
  writeFile(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (url) =>
          `  <url><loc>${absoluteUrl(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${sitemapPriority(url)}</priority></url>`,
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
  console.log(`Built ${urls.length} public pages plus 404.html`);
}

build();
