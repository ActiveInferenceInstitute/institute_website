import fs from "node:fs";
import path from "node:path";
import {
  urlDirForSlug,
  outputPathForSlug,
  hrefForSlug,
} from "./url-taxonomy.mjs";
import {
  escapeHtml,
  sanitizePublicProse,
  proseParagraphs,
  slugifyAnchor,
  title_case_token_js,
} from "./lib/text.mjs";
import {
  root,
  contentDir,
  loadJson,
  SITE_VERSION,
  EXPORT_PROVENANCE,
  SOURCE_FINGERPRINT,
  EXPORTED_AT,
  loadProjectsData,
  siteData,
  liveSourceById,
  pageBySlug,
  typeById,
  categoryById,
  audienceById,
  ALL_ROUTED_SLUGS,
} from "./data.mjs";
import { out, ensure } from "./lib/paths.mjs";
import { writeFile } from "./lib/output.mjs";
import { listText, rowAnchor } from "./render/text.mjs";
import { cspContent } from "./render/security.mjs";
import {
  isVerifiedExternalUrl,
  slugToHref,
  resolveInternalHref,
  relPrefix,
  absoluteUrl,
  externalHref,
} from "./render/urls.mjs";
import {
  linkAttrs,
  sourceFor,
  publicHrefForSource,
  resolveLink,
  resolveLinks,
} from "./render/links.mjs";
import { actionButtons, linkChips, linkList } from "./render/page-sections.mjs";
import { sectionHeading, cardGrid, breadcrumb, pageGuide } from "./render/components.mjs";
import { optionList } from "./render/forms.mjs";
import { publicPagePager } from "./render/pager.mjs";
import { sourceAnchor } from "./render/sources.mjs";
import { metaDescription } from "./render/seo.mjs";
import { layout } from "./render/layout.mjs";
import { buildSearchIndex } from "./render/search.mjs";
import {
  recordMatchesPage,
  normalizedCuratedResources,
  normalizedOfficialPages,
  normalizedRepositories,
  allResourceEntries,
  uniqueEntries,
  normalizeResource,
  entriesForPage,
} from "./lib/resources.mjs";
import { resourceBadge, resourceCards } from "./render/resources.mjs";
import {
  brandAsset,
  instituteosCounts,
  peopleRows,
  projectRows,
  ideaRows,
  ontologyRows,
  researchRows,
} from "./lib/instituteos.mjs";
import {
  dataTable,
  tableSection,
  peopleTable,
  projectsTable,
  ideasTable,
  ontologyTable,
  researchTable,
  organizationsTable,
  governanceMembersTable,
  processesTable,
  publicationsTable,
  policiesTable,
} from "./render/tables.mjs";

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
          ? `<img class="knowledge-brand-image" src="${escapeHtml(relPrefix(currentDir) + darkAsset.path)}" alt="${escapeHtml(darkAsset.alt)}" width="937" height="819" loading="lazy" decoding="async">`
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
    slug: "knowledge",
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
    slug: "index",
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
    slug: page.slug,
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
      const domainHref = slugToHref(`ecosystem/${domain.slug}`, currentDir);
      return `<article class="info-card domain-card" id="${escapeHtml(slugifyAnchor(`domain-${domain.slug}`))}">
        <h3><a href="${domainHref}">${escapeHtml(sanitizePublicProse(domain.domain))}</a></h3>
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

// Per-domain ecosystem landing pages (/ecosystem/<domain>/). One page per
// domain that has mapped projects, listing each project as an internal link
// (when a real page exists) or a plain article (when it does not). Emitted
// programmatically via slugRenderers — NOT added to siteData.pages, so it is
// not subject to the curated-page contract. All links are CSP-safe internal
// hrefs; layout() supplies CSP/canonical/nav/footer.
function ecosystemDomainPages() {
  const domains = (siteData.instituteos.domainProjects.domains || []).filter((domain) => (domain.projects || []).length);
  const slugToPage = new Set(siteData.pages.map((page) => page.slug));
  return domains.map((domain) => {
    const routedSlug = `ecosystem/${domain.slug}`;
    const currentDir = urlDirForSlug(routedSlug);
    const domainName = sanitizePublicProse(domain.domain);
    const cards = (domain.projects || [])
      .map((project) => {
        const pageSlug = projectPageSlugForDataId(project.id);
        const label = escapeHtml(sanitizePublicProse(project.title || project.id));
        if (pageSlug && slugToPage.has(pageSlug)) {
          return `<a class="resource-card internal-card" href="${slugToHref(pageSlug, currentDir)}"><strong>${label}</strong></a>`;
        }
        return `<article class="resource-card"><strong>${label}</strong></article>`;
      })
      .join("");
    const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><a href="${hrefForSlug("ecosystem", currentDir)}">Ecosystem</a><span aria-hidden="true">/</span><span>${escapeHtml(domainName)}</span></nav>
    <p class="eyebrow">Domain of application</p>
    <h1>${escapeHtml(domainName)}</h1>
    <p>${(domain.projects || []).length} public project${(domain.projects || []).length === 1 ? "" : "s"} mapped to the ${escapeHtml(domainName)} domain of application.</p>
  </section>
  <section class="content-band" id="domain-projects">
    ${sectionHeading({ eyebrow: "Projects", title: `Projects in ${domainName}` })}
    <div class="resource-grid">${cards}</div>
    <p class="mini-links"><a href="${hrefForSlug("ecosystem", currentDir)}">Back to the ecosystem overview</a></p>
  </section>`;
    return {
      slug: routedSlug,
      html: layout({
        title: domainName,
        description: `Public Active Inference Institute projects in the ${domainName} domain of application.`,
        currentDir,
        body,
        slug: routedSlug,
      }),
    };
  });
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
    slug: "resources",
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
    slug: "directory",
  });
}

// Dedicated full-text search page (/search/). Emitted programmatically like the
// knowledge/directory pages — NOT a curated src/content/pages JSON, so it is not
// subject to the curated-page contract. It reuses the embedded search index
// (search-data.js) and a self-hosted enhancement script (search-page.js) that
// renders the FULL grouped result set and prefills from the ?q= query string.
function searchPage() {
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

function sitemapPage() {
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
          { src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "assets/img/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}

function buildSecurityTxt() {
  // Derive Expires from the export date (+1 year) so it stays deterministic with
  // the rest of the build and never silently lapses against a stale hardcoded date.
  const base = EXPORTED_AT ? new Date(EXPORTED_AT) : null;
  const expires =
    base && !Number.isNaN(base.getTime())
      ? new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : "2027-06-19T00:00:00.000Z";
  return [
    `Contact: mailto:${siteData.site.email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${absoluteUrl(".well-known/security.txt")}`,
    "",
  ].join("\n");
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
    ["search", searchPage],
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
