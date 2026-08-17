import { hrefForSlug, urlDirForSlug } from "../url-taxonomy.mjs";
import { escapeHtml, title_case_token_js } from "../lib/text.mjs";
import { siteData } from "../data.mjs";
import {
  instituteosCounts,
  knowledgeRowTotal,
  brandAsset,
  projectRows,
  ideaRows,
  ontologyRows,
  publicationRows,
} from "../lib/instituteos.mjs";
import { rowAnchor } from "./text.mjs";
import { relPrefix } from "./urls.mjs";
import { sectionHeading, cardGrid } from "./components.mjs";
import { actionButtons, linkChips } from "./page-sections.mjs";
import {
  tableSection,
  projectsTable,
  ideasTable,
  ontologyTable,
  governanceMembersTable,
  publicationsTable,
  policiesTable,
  programsTable,
  citationsTable,
} from "./tables.mjs";
import { ontologyGraphSection } from "./graphs.mjs";
import { layout } from "./layout.mjs";
import { domainsSection } from "./domains.mjs";

export function knowledgePreview(page, currentDir = "") {
  const previewConfig = {
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
        <p>Structured public tables for public repositories, ideas, ontology relationships, governance, publications, policies, programs, and literature across the Active Inference Institute ecosystem.</p>
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
    <div><strong>${counts.projects}</strong><span>public repositories</span></div>
    <div><strong>${counts.ideas}</strong><span>idea rows</span></div>
    <div><strong>${counts.ontology}</strong><span>relationship rows</span></div>
    <div><strong>${counts.members}</strong><span>governance members</span></div>
    <div><strong>${counts.publications}</strong><span>publications</span></div>
    <div><strong>${counts.policies}</strong><span>policies</span></div>
    <div><strong>${counts.programs}</strong><span>programs</span></div>
    <div><strong>${counts.citations}</strong><span>citations</span></div>
  </section>
  <section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">On this page</p>
        <h2>Open Source Map guide</h2>
      </div>
      <nav aria-label="Open Source Map sections">
        <a href="#public-data-policy">Public link policy</a>
        <a href="#projects-table">Repositories</a>
        <a href="#ideas-table">Ideas</a>
        <a href="#ontology-table">Ontology</a>
        <a href="#members-table">Governance</a>
        <a href="#publications-table">Publications</a>
        <a href="#policies-table">Policies</a>
        <a href="#programs-table">Programs</a>
        <a href="#citations-table">Literature</a>
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
      text: "These tables render public repositories, public concept metadata, and public governance records only. Internal operational records and private working details are excluded.",
    })}
    ${cardGrid([
      { title: "Repositories", text: "Public ActiveInferenceInstitute repositories with project family, type, language, stars, and updated date.", links: [{ label: "Repository table", href: "#projects-table" }] },
      { title: "Ideas", text: "Concept, method, tool, value, and publication nodes from public-safe tech-tree metadata.", links: [{ label: "Ideas table", href: "#ideas-table" }] },
      { title: "Ontology", text: "Directed relationships between public ideas, methods, values, tools, and applications.", links: [{ label: "Ontology table", href: "#ontology-table" }] },
      { title: "Governance", text: "Public governance members including board, officers, and registered organizational roles.", links: [{ label: "Governance table", href: "#members-table" }] },
      { title: "Publications", text: "Approved public communications including reports, announcements, and newsletters.", links: [{ label: "Publications table", href: "#publications-table" }] },
      { title: "Policies", text: "Public governance policy registry with category, status, version, and description.", links: [{ label: "Policies table", href: "#policies-table" }] },
      { title: "Programs", text: "Public participation, learning, research, and support pathways for contributors.", links: [{ label: "Programs table", href: "#programs-table" }] },
      { title: "Literature", text: "Bibliographic records that ground the public Active Inference domain pages.", links: [{ label: "Literature table", href: "#citations-table" }] },
    ], currentDir)}
  </section>
  <section class="content-band page-index-band">
    <div class="knowledge-tools" aria-label="Open Source Map filters">
      <label>
        <span>Search Open Source Map</span>
        <input id="knowledge-search" type="search" placeholder="Search repositories, ideas, relationships, governance, publications">
      </label>
      <label>
        <span>Table</span>
        <select id="knowledge-kind">
          <option value="">All tables</option>
          <option value="projects">Repositories</option>
          <option value="ideas">Ideas</option>
          <option value="ontology">Ontology</option>
          <option value="members">Governance</option>
          <option value="publications">Publications</option>
          <option value="policies">Policies</option>
          <option value="programs">Programs</option>
          <option value="citations">Literature</option>
        </select>
      </label>
      <p id="knowledge-count" class="result-count" aria-live="polite">${knowledgeRowTotal()} rows shown</p>
    </div>
  </section>
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
    id: "members-table",
    eyebrow: "Governance",
    title: `${counts.members} governance member rows`,
    text: "Public governance members including board, officers, and registered organizational roles.",
    countLabel: `${counts.members} governance members shown`,
    tableHtml: governanceMembersTable(),
  })}
  ${tableSection({
    id: "publications-table",
    eyebrow: "Publications",
    title: `${counts.publications} publication rows`,
    text: "Approved public communications — reports, announcements, and newsletters.",
    countLabel: `${counts.publications} publications shown`,
    tableHtml: publicationsTable(publicationRows(), currentDir),
  })}
  ${tableSection({
    id: "policies-table",
    eyebrow: "Policies",
    title: `${counts.policies} governance policy rows`,
    text: "Public governance policy registry with category, current status, version, and description.",
    countLabel: `${counts.policies} policies shown`,
    tableHtml: policiesTable(),
  })}
  ${tableSection({
    id: "programs-table",
    eyebrow: "Programs",
    title: `${counts.programs} public program rows`,
    text: "Structured participation and support pathways derived from the Institute program registry.",
    countLabel: `${counts.programs} programs shown`,
    tableHtml: programsTable(),
  })}
  ${tableSection({
    id: "citations-table",
    eyebrow: "Literature",
    title: `${counts.citations} public citation rows`,
    text: "Bibliographic records used to ground the public Active Inference research-domain pages.",
    countLabel: `${counts.citations} citations shown`,
    tableHtml: citationsTable(),
  })}
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the public site" })}
    ${cardGrid([
      { title: "About", text: "Institutional orientation and public visitor pathways.", links: [{ label: "About the Institute", href: "about.html" }] },
      { title: "Projects", text: "Public project, repository, and applied-work pathways.", links: [{ label: "Project map", href: "projects.html" }] },
      { title: "Learning", text: "Learning paths, research references, and concept orientation.", links: [{ label: "Learning and Research", href: "learning.html" }] },
      { title: "Directory", text: "Every rendered public page, resource group, official link, repository, and table row.", links: [{ label: "Global Directory", href: "directory.html" }] },
    ], currentDir)}
  </section>
  ${domainsSection(currentDir)}`;
  return layout({
    title: "Open Source Map",
    description: "Structured public tables for ActiveInferenceInstitute repositories, ideas, ontology relationships, governance, publications, policies, programs, and literature.",
    currentDir,
    body,
    slug: "knowledge",
  });
}

export function knowledgeDirectoryRows(currentDir = "") {
  const rows = [
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
    ...(siteData.instituteos.entities.people || []).map((item) => {
      const title = item.title || "";
      const roleList = (item.roles || []).slice(0, 2);
      // When the title is just the first role restated (e.g. title "Board
      // Member" with roles ["Board Member", "Director"]), prepending the title
      // duplicates it verbatim ("Board Member Board Member, Director"). Drop
      // the title in that case and summarize from the role list alone.
      const summary = title && title.trim().toLowerCase() === (roleList[0] || "").trim().toLowerCase()
        ? roleList.join(", ")
        : `${title} ${roleList.join(", ")}`.trim();
      return {
        kind: "Governance Members",
        label: item.name,
        summary,
        href: hrefForSlug("knowledge", currentDir, rowAnchor("member", item.id)),
      };
    }),
    ...publicationRows().map((item) => ({
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
    ...(siteData.instituteos.programs.records || []).map((item) => ({
      kind: "Programs",
      label: item.name,
      summary: `${title_case_token_js(item.category || "")} / ${title_case_token_js(item.status || "")}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("program", item.id)),
    })),
    ...(siteData.instituteos.citations.records || []).map((item) => ({
      kind: "Literature",
      label: item.title,
      summary: `${item.year || "n.d."} / ${item.venue || "Reference"}`,
      href: hrefForSlug("knowledge", currentDir, rowAnchor("citation", item.id)),
    })),
  ];
  return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
}
