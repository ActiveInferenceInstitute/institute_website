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

const pages = fs
  .readdirSync(path.join(contentDir, "pages"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => loadJson(path.join("pages", file)))
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
  },
  pages,
};

const liveSourceById = new Map((siteData.liveSources.sources || []).map((source) => [source.id, source]));
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

const slugToHref = (slug) => (slug === "index" ? "index.html" : `${slug}.html`);

const slugifyAnchor = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function relPrefix(currentPath) {
  return currentPath.includes("/") ? "../" : "";
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

function nav(prefix = "") {
  const groups = siteData.navigation
    .map((group, index) => {
      const id = `nav-menu-${index}-${slugifyAnchor(group.label)}`;
      const items = (group.items || [])
        .map((item) => `<a href="${prefix}${escapeHtml(item.href)}" role="menuitem">${escapeHtml(item.label)}</a>`)
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

function actionButtons(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="hero-actions">${resolved
    .map((link, index) => {
      const kind = index === 0 ? "primary" : "secondary";
      return `<a class="button ${kind}" href="${escapeHtml(link.href)}"${linkAttrs(link.href)}>${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}

function linkChips(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="link-chips">${resolved
    .map((link) => {
      const meta = link.meta ? `<em>${escapeHtml(link.meta)}</em>` : "";
      return `<a href="${escapeHtml(link.href)}"${linkAttrs(link.href)}><span>${escapeHtml(link.label)}</span>${meta}</a>`;
    })
    .join("")}</div>`;
}

function linkList(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="mini-links">${resolved
    .map((link) => `<a href="${escapeHtml(link.href)}"${linkAttrs(link.href)}>${escapeHtml(link.label)}</a>`)
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

function layout({ title, description, currentPath, body, bodyClass = "" }) {
  const prefix = relPrefix(currentPath);
  const pageTitle = title === siteData.site.name ? title : `${title} | ${siteData.site.name}`;
  const pageDescription = description || siteData.site.description;
  const canonicalUrl = absoluteUrl(currentPath);
  const normalizedBody = body.trim();
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
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(siteData.site.name)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="${prefix}index.html" aria-label="${escapeHtml(siteData.site.name)} home">
      <span class="brand-mark">AI</span>
      <span>
        <strong>${escapeHtml(siteData.site.name)}</strong>
        <em>${escapeHtml(siteData.site.tagline)}</em>
      </span>
    </a>
    ${nav(prefix)}
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
      <a href="${prefix}resources.html">Resources</a>
      <a href="${prefix}directory.html">Directory</a>
      <a href="${prefix}knowledge.html">Open Source Map</a>
      <a href="${prefix}get-involved.html">Get involved</a>
    </div>
    <div class="social-links" aria-label="Verified public links">
      ${socialLinks()}
    </div>
  </footer>
  <script src="${prefix}assets/js/site.js" defer></script>
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

function cardGrid(cards = []) {
  return `<div class="card-grid">${cards
    .map((card) => {
      const links = linkChips(card.links);
      return `<article class="info-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>${links ? `\n        ${links}` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function breadcrumb(page) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="index.html">Home</a>
    <span aria-hidden="true">/</span>
    <a href="directory.html">Directory</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(page.title)}</span>
  </nav>`;
}

function pageGuide(page) {
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
        <a href="knowledge.html">Open Source Map</a>
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

function relatedPages(page) {
  const related = relatedSlugsForPage(page).map((slug) => pageBySlug.get(slug)).filter(Boolean);
  return `<div class="resource-grid compact-grid">${related
    .map(
      (relatedPage) => `<a class="resource-card internal-card" href="${slugToHref(relatedPage.slug)}">
        <span>${escapeHtml(relatedPage.audience || "Related guide")}</span>
        <strong>${escapeHtml(relatedPage.title)}</strong>
        <p>${escapeHtml(relatedPage.lede)}</p>
      </a>`,
    )
    .join("")}</div>`;
}

function audiencePathwaySection() {
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
          <a class="button secondary" href="${escapeHtml(pathway.primaryHref)}">${escapeHtml(pathway.actionLabel || "Open pathway")}</a>
          ${linkList(pathway.links)}
        </article>`)
        .join("")}
    </div>
  </section>`;
}

function bestNextActions(page) {
  const primary = resolveLinks(page.primaryActions || []).slice(0, 3);
  const groups = page.resourceGroups || [];
  const related = relatedSlugsForPage(page)
    .map((slug) => pageBySlug.get(slug))
    .filter(Boolean)
    .slice(0, 2)
    .map((relatedPage) => ({
      label: relatedPage.title,
      href: slugToHref(relatedPage.slug),
    }));
  const resourceLinks = [
    groups[0] ? { label: "Filtered resources", href: `resources.html#${groups[0]}` } : { label: "All resources", href: "resources.html" },
    { label: "Global directory", href: "directory.html" },
  ];
  const actions = [...primary, ...resourceLinks, ...related];
  return `<section class="content-band next-action-band" id="next-actions">
    <div class="next-action-panel">
      <div>
        <p class="eyebrow">Best next actions</p>
        <h2>${escapeHtml(page.title)} pathway</h2>
        <p>Start with the highest-signal public links for this page, then continue through the related resource and directory views.</p>
      </div>
      ${linkChips(actions)}
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

function resourceCards(resources = [], { compact = false, filterable = true, sortable = false, wrapperAttrs = "" } = {}) {
  if (!resources.length) {
    return '<p class="lede">No public resources are assigned here yet. Use the global directory for the full verified list.</p>';
  }
  const className = compact ? "resource-grid compact-grid" : "resource-grid";
  return `<div class="${className}"${wrapperAttrs}>${resources
    .map((resource) => {
      const related = (resource.relatedSlugs || [])
        .map((slug) => pageBySlug.get(slug))
        .filter(Boolean)
        .map((page) => `<a href="${slugToHref(page.slug)}">${escapeHtml(page.title)}</a>`)
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

function publicPagePager(page) {
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  const prev = siteData.pages[index - 1];
  const next = siteData.pages[index + 1];
  return `<nav class="pager page-pager" aria-label="${escapeHtml(page.title)} adjacent pages">
    ${prev ? `<a href="${slugToHref(prev.slug)}">Previous: ${escapeHtml(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${slugToHref(next.slug)}">Next: ${escapeHtml(next.title)}</a>` : "<span></span>"}
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
  };
}

function knowledgeSearchText(values = []) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .join(" ")
    .toLowerCase();
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

function title_case_token_js(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function knowledgePreview(page) {
  const previewConfig = {
    about: {
      eyebrow: "Public GitHub people",
      title: "Visible public contributors",
      text: "A compact view of externally visible GitHub profiles connected to public Institute repositories.",
      table: peopleTable(peopleRows(6)),
      href: "knowledge.html#people-table",
    },
    projects: {
      eyebrow: "Public repositories",
      title: "Open-source project registry",
      text: "Repository rows preserve public language, stars, update recency, project family, and documentation links.",
      table: projectsTable(projectRows(8)),
      href: "knowledge.html#projects-table",
    },
    learning: {
      eyebrow: "Ideas and methods",
      title: "Concepts and methods from the learning graph",
      text: "A compact selection from the Active Inference and Free Energy Principle tech-tree nodes.",
      table: ideasTable(ideaRows(8)),
      href: "knowledge.html#ideas-table",
    },
    ecosystem: {
      eyebrow: "Ontology relationships",
      title: "Relationships across the conceptual graph",
      text: "A compact relationship view showing how ideas, methods, values, and tools connect.",
      table: ontologyTable(ontologyRows(8)),
      href: "knowledge.html#ontology-table",
    },
  }[page.slug];
  if (!previewConfig) {
    return "";
  }
  return `<section class="content-band knowledge-preview-band" id="knowledge-preview">
    ${sectionHeading({ eyebrow: previewConfig.eyebrow, title: previewConfig.title, text: previewConfig.text })}
    ${previewConfig.table}
    <p class="section-link"><a href="${previewConfig.href}">Open the full Open Source Map</a></p>
  </section>`;
}

function knowledgePage() {
  const counts = instituteosCounts();
  const darkAsset = brandAsset("dark");
  const body = `
  <section class="page-hero compact knowledge-hero">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span>Open Source Map</span></nav>
    <p class="eyebrow">Public open-source map</p>
    <div class="knowledge-hero-layout">
      <div>
        <h1>Open Source Map</h1>
        <p>Structured public tables for externally visible people, public repositories, research links, ideas, and ontology relationships across the Active Inference Institute ecosystem.</p>
        ${actionButtons([
          { label: "Filter resources", href: "resources.html" },
          { label: "Browse repositories", href: "directory.html#repositories" },
          { label: "Start learning", sourceId: "start-docs" },
        ])}
      </div>
      ${
        darkAsset
          ? `<img class="knowledge-brand-image" src="${escapeHtml(darkAsset.path)}" alt="${escapeHtml(darkAsset.alt)}">`
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
      ])}
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
    ])}
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
        </select>
      </label>
      <p id="knowledge-count" class="result-count" aria-live="polite">${counts.people + counts.projects + counts.ideas + counts.ontology + counts.research} rows shown</p>
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
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the public site" })}
    ${cardGrid([
      { title: "About", text: "Institutional orientation and public visitor pathways.", links: [{ label: "About the Institute", href: "about.html" }] },
      { title: "Projects", text: "Public project, repository, and applied-work pathways.", links: [{ label: "Project map", href: "projects.html" }] },
      { title: "Learning", text: "Learning paths, research references, and concept orientation.", links: [{ label: "Learning and Research", href: "learning.html" }] },
      { title: "Directory", text: "Every rendered public page, resource group, official link, repository, and table row.", links: [{ label: "Global Directory", href: "directory.html" }] },
    ])}
  </section>`;
  return layout({
    title: "Open Source Map",
    description: "Structured public tables for ActiveInferenceInstitute people, repositories, research links, ideas, and ontology relationships.",
    currentPath: "knowledge.html",
    body,
  });
}

function knowledgeDirectoryRows() {
  const rows = [
    ...siteData.instituteos.people.records.map((item) => ({
      kind: "Public People",
      label: item.name,
      summary: `${item.publicRole}: @${item.login}`,
      href: `knowledge.html#${rowAnchor("person", item.id)}`,
    })),
    ...siteData.instituteos.projects.records.map((item) => ({
      kind: "Repositories",
      label: item.title,
      summary: `${item.projectFamily} / ${item.language || "Unspecified"}`,
      href: `knowledge.html#${rowAnchor("project", item.id)}`,
    })),
    ...siteData.instituteos.ideas.records.map((item) => ({
      kind: "Ideas and Methods",
      label: item.label,
      summary: `${title_case_token_js(item.nodeType)} / ${item.maturity}`,
      href: `knowledge.html#${rowAnchor("idea", item.id)}`,
    })),
    ...siteData.instituteos.ontology.edges.map((item) => ({
      kind: "Ontology",
      label: `${item.sourceLabel} -> ${item.targetLabel}`,
      summary: `${item.treeTitle} / ${item.relationship}`,
      href: `knowledge.html#${rowAnchor("ontology", item.id)}`,
    })),
    ...researchRows().map((item) => ({
      kind: "Research and Papers",
      label: item.label,
      summary: `${item.categoryLabel} / ${item.audienceLabel}`,
      href: `knowledge.html#${rowAnchor("research", item.sourceId)}`,
    })),
  ];
  return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}

function homePage() {
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
      ])}
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
        <a href="directory.html"><strong>Global index</strong><span>Every page, resource, official link, and repository</span></a>
        <a href="resources.html"><strong>Filter resources</strong><span>Search by type, category, audience, and tag</span></a>
        <a href="knowledge.html"><strong>Open Source Map</strong><span>Public people, repositories, research, ideas, and ontology tables</span></a>
        <a href="get-involved.html"><strong>Participate</strong><span>Channels, activities, support, and contact</span></a>
      </aside>
    </div>
  </section>

  ${audiencePathwaySection()}

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
    ])}
  </section>

  <section class="content-band">
    ${sectionHeading({ eyebrow: "Featured resources", title: "Verified public entry points", text: "These resources are checked through the public link registry and grouped by visitor need." })}
    ${resourceCards(featuredResources, { filterable: false })}
  </section>`;
  return layout({
    title: siteData.site.name,
    currentPath: "index.html",
    description: siteData.site.description,
    body,
    bodyClass: "home",
  });
}

function publicPage(page) {
  const curated = normalizedCuratedResources();
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const body = `
  <section class="page-hero compact">
    ${breadcrumb(page)}
    <p class="eyebrow">${escapeHtml(page.audience || "Public guide")}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.subtitle)}</p>
    ${actionButtons(page.primaryActions)}
  </section>
  ${pageGuide(page)}
  ${bestNextActions(page)}
  <section class="content-band">
    <p class="lede">${escapeHtml(page.lede)}</p>
    <div class="article-stack">
      ${page.sections
        .map((section) => {
          const links = linkChips(section.links);
          return `<article class="article-block" id="${escapeHtml(slugifyAnchor(section.heading))}">
            <h2>${escapeHtml(section.heading)}</h2>
            <p>${escapeHtml(section.body)}</p>${links ? `\n            ${links}` : ""}
          </article>`;
        })
        .join("")}
    </div>
  </section>
  <section class="content-band muted" id="key-surfaces">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards)}
  </section>
  ${knowledgePreview(page)}
  <section class="content-band" id="resources">
    ${sectionHeading({ eyebrow: "Related resources", title: "Public links for this page", text: "External links are resolved from the shared registry so visitor-facing destinations stay centralized and checkable." })}
    ${resourceCards(entriesForPage(page, curated, 12))}
  </section>
  <section class="content-band muted" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute surfaces" })}
    ${resourceCards(entriesForPage(page, official, 8), { compact: true })}
  </section>
  <section class="content-band" id="repositories">
    ${sectionHeading({ eyebrow: "Repositories", title: "Related open-source repositories" })}
    ${resourceCards(entriesForPage(page, repositories, page.slug === "projects" ? 16 : 8), { compact: true })}
    <p class="section-link"><a href="directory.html#repositories">View all ${siteData.repositories.repositories.length} public repositories</a></p>
  </section>
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the site" })}
    ${relatedPages(page)}
  </section>
  ${publicPagePager(page)}`;
  return layout({
    title: page.title,
    description: page.lede,
    currentPath: `${page.slug}.html`,
    body,
  });
}

function optionList(items) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
}

function resourcesPage() {
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
        ${resourceCards(groupResources)}
      </section>`;
    })
    .join("");
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span>Resources</span></nav>
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
    ])}
  </section>
  <section class="content-band muted" id="featured">
    ${sectionHeading({ eyebrow: "Featured", title: "High-signal public entry points" })}
    ${resourceCards(featured, { filterable: false })}
  </section>
  <section class="content-band" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute web surfaces", text: "These are official pages, subdomains, and public program surfaces that resolve through the verified live-source registry." })}
    ${resourceCards(official, { compact: true, filterable: false })}
  </section>
  <section class="content-band muted" id="official-shortlinks">
    ${sectionHeading({ eyebrow: "Official shortlinks", title: "Compact public subdomain map", text: "Shortlinks route visitors into official program, learning, preparation, project, and knowledge-base spaces." })}
    ${resourceCards(shortlinks, { compact: true, filterable: false })}
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
    ${resourceCards(repositories, { compact: true, filterable: false, sortable: true, wrapperAttrs: ' id="repository-list" data-repository-list' })}
  </section>
  <section class="content-band muted" id="learning-research">
    ${sectionHeading({ eyebrow: "Learning / Research", title: "Study, research, and technical reference pathways" })}
    ${resourceCards(learningResearch, { filterable: false })}
  </section>
  <section class="content-band" id="participation-view">
    ${sectionHeading({ eyebrow: "Participation", title: "Community, contribution, and support pathways" })}
    ${resourceCards(participation, { filterable: false })}
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
    currentPath: "resources.html",
    body,
  });
}

function directoryPage() {
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const resources = allResourceEntries();
  const publicPages = siteData.pages;
  const shortlinks = official.filter((item) => item.shortlink);
  const knowledgeRows = knowledgeDirectoryRows();
  const officialColumns = [
    { label: "Official page", render: (item) => `<a href="${escapeHtml(item.href)}"${linkAttrs(item.href)}>${escapeHtml(item.label)}</a>` },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Audience", render: (item) => escapeHtml(item.audienceLabel) },
    { label: "Related", render: (item) => (item.relatedSlugs || []).map((slug) => pageBySlug.get(slug)).filter(Boolean).map((page) => `<a href="${slugToHref(page.slug)}">${escapeHtml(page.title)}</a>`).join(" ") },
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
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span>Directory</span></nav>
    <p class="eyebrow">Global index</p>
    <h1>Directory</h1>
    <p>Every public page, section, resource group, verified external link, official page, and public repository indexed by this site.</p>
    ${actionButtons([{ label: "Filter resources", href: "resources.html" }, { label: "Open Source Map", href: "knowledge.html" }, { label: "Project map", href: "projects.html" }])}
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
          <h3><a href="${slugToHref(page.slug)}">${escapeHtml(page.title)}</a></h3>
          <p>${escapeHtml(page.lede)}</p>
          <div class="mini-links">${page.sections.map((section) => `<a href="${slugToHref(page.slug)}#${slugifyAnchor(section.heading)}">${escapeHtml(section.heading)}</a>`).join("")}</div>
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
    })))}
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
    ])}
    ${dataTable({ caption: "Every Open Source Map row anchor.", columns: knowledgeColumns, rows: knowledgeRows })}
  </section>`;
  return layout({
    title: "Directory",
    description: "Global index of public Active Inference Institute pages, resources, official links, and repositories.",
    currentPath: "directory.html",
    body,
  });
}

function writeFile(file, html) {
  ensure(path.dirname(out(file)));
  fs.writeFileSync(out(file), html.replace(/[ \t]+$/gm, ""), "utf8");
}

function build() {
  writeFile("index.html", homePage());
  for (const page of siteData.pages) {
    writeFile(`${page.slug}.html`, publicPage(page));
  }
  writeFile("knowledge.html", knowledgePage());
  writeFile("resources.html", resourcesPage());
  writeFile("directory.html", directoryPage());
  writeFile(
    "404.html",
    layout({
      title: "Page not found",
      currentPath: "404.html",
      body: '<section class="page-hero compact"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span>404</span></nav><p class="eyebrow">404</p><h1>Page not found</h1><p>Use the navigation, resource directory, or global index to return to the Institute website.</p><a class="button primary" href="index.html">Home</a></section>',
    }),
  );
  writeFile(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("sitemap.xml")}\n`,
  );
  const urls = [
    "index.html",
    ...siteData.pages.map((page) => `${page.slug}.html`),
    "knowledge.html",
    "resources.html",
    "directory.html",
  ];
  writeFile(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${absoluteUrl(url)}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
  );
  console.log(`Built ${urls.length} public pages plus 404.html`);
}

build();
