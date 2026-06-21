import { hrefForSlug, urlDirForSlug } from "../url-taxonomy.mjs";
import { escapeHtml, title_case_token_js } from "../lib/text.mjs";
import { siteData } from "../data.mjs";
import {
  instituteosCounts,
  brandAsset,
  peopleRows,
  projectRows,
  ideaRows,
  ontologyRows,
  researchRows,
} from "../lib/instituteos.mjs";
import { rowAnchor } from "./text.mjs";
import { relPrefix } from "./urls.mjs";
import { sectionHeading, cardGrid } from "./components.mjs";
import { actionButtons, linkChips } from "./page-sections.mjs";
import {
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
} from "./tables.mjs";
import { ontologyGraphSection } from "./graphs.mjs";
import { layout } from "./layout.mjs";

export function knowledgePreview(page, currentDir = "") {
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

export function knowledgePage() {
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

export function knowledgeDirectoryRows(currentDir = "") {
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
