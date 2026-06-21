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
import { narrativeSection } from "./render/narrative.mjs";
import { projectPageSlugForDataId, relatedProjectsSection } from "./pages/projects.mjs";
import { domainProjectsSection, ecosystemDomainPages } from "./pages/ecosystem.mjs";
import { instituteosFeatureSections } from "./render/feature-sections.mjs";
import { knowledgePreview, knowledgePage, knowledgeDirectoryRows } from "./render/knowledge.mjs";
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
import {
  flattenGraphMeta,
  projectGraphData,
  graphFigure,
  techTreeExplorerSection,
  ontologyGraphSection,
  governanceGraphSection,
} from "./render/graphs.mjs";

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
