import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse } from "./text.mjs";
import { normalizedCuratedResources } from "./resources.mjs";
import { rowAnchor } from "../render/text.mjs";

export function brandAsset(theme = "dark") {
  return (siteData.instituteos.assets.records || []).find((asset) => asset.theme === theme) || null;
}

export function instituteosCounts() {
  return {
    projects: siteData.instituteos.projects.records.length,
    ideas: siteData.instituteos.ideas.records.length,
    ontology: siteData.instituteos.ontology.edges.length,
    members: (siteData.instituteos.entities.people || []).length,
    publications: publicationRows().length,
    policies: (siteData.instituteos.policies.records || []).length,
    programs: (siteData.instituteos.programs.records || []).length,
    citations: (siteData.instituteos.citations.records || []).length,
  };
}

// Total rows the Open Source Map actually renders. The page's own count and the
// home-page gate metric both read this, so a table added to or retired from
// /knowledge/ moves both numbers at once instead of leaving one of them lying.
export function knowledgeRowTotal() {
  const counts = instituteosCounts();
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

export function knowledgeSearchText(values = []) {
  return sanitizePublicProse(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(" "),
  ).toLowerCase();
}

export function knowledgeDataAttrs(kind, values = []) {
  return ` data-knowledge-row data-knowledge-kind="${escapeHtml(kind)}" data-knowledge-search="${escapeHtml(knowledgeSearchText(values))}"`;
}

export function projectRows(limit = Infinity) {
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

export function ideaRows(limit = Infinity) {
  return siteData.instituteos.ideas.records.slice(0, limit).map((idea) => ({
    ...idea,
    rowId: rowAnchor("idea", idea.id),
    dataAttrs: knowledgeDataAttrs("ideas", [idea.label, idea.nodeType, idea.maturity, idea.summary, idea.tags, idea.trees]),
  }));
}

export function ontologyRows(limit = Infinity) {
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

export function entityPeopleRows(limit = Infinity) {
  return (siteData.instituteos.entities.people || []).slice(0, limit).map((person) => ({
    ...person,
    rowId: rowAnchor("member", person.id),
    dataAttrs: knowledgeDataAttrs("members", [person.name, person.title, person.roles, person.tags]),
  }));
}

export function communicationRows(limit = Infinity) {
  return (siteData.instituteos.communications.records || []).slice(0, limit).map((comm) => ({
    ...comm,
    rowId: rowAnchor("publication", comm.id),
    dataAttrs: knowledgeDataAttrs("publications", [comm.title, comm.type, comm.date, comm.author]),
  }));
}

export function newsletterPublicationRows(limit = Infinity) {
  return (siteData.instituteos.newsletter?.records || [])
    .filter((record) => record.type === "newsletter")
    .slice(0, limit)
    .map((record) => ({
      ...record,
      rowId: rowAnchor("publication", record.id),
      dataAttrs: knowledgeDataAttrs("publications", [record.title, record.type, record.date, record.author]),
    }));
}

export function publicationRows(limit = Infinity) {
  const otherCommunications = communicationRows().filter((item) => item.type !== "newsletter");
  return [...otherCommunications, ...newsletterPublicationRows()]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, limit);
}

export function policyRows(limit = Infinity) {
  return (siteData.instituteos.policies.records || []).slice(0, limit).map((pol) => ({
    ...pol,
    rowId: rowAnchor("policy", pol.id),
    dataAttrs: knowledgeDataAttrs("policies", [pol.title, pol.category, pol.status, pol.description, pol.tags]),
  }));
}

export function programRows(limit = Infinity) {
  return (siteData.instituteos.programs.records || []).slice(0, limit).map((program) => ({
    ...program,
    rowId: rowAnchor("program", program.id),
    dataAttrs: knowledgeDataAttrs("programs", [program.name, program.category, program.status, program.summary, program.topics]),
  }));
}

export function citationRows(limit = Infinity) {
  return (siteData.instituteos.citations.records || []).slice(0, limit).map((citation) => ({
    ...citation,
    rowId: rowAnchor("citation", citation.id),
    dataAttrs: knowledgeDataAttrs("citations", [citation.title, citation.authors, citation.year, citation.venue, citation.tags]),
  }));
}
