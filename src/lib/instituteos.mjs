import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse } from "./text.mjs";
import { normalizedCuratedResources } from "./resources.mjs";
import { rowAnchor } from "../render/text.mjs";

export function brandAsset(theme = "dark") {
  return (siteData.instituteos.assets.records || []).find((asset) => asset.theme === theme) || null;
}

export function instituteosCounts() {
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

export function peopleRows(limit = Infinity) {
  return siteData.instituteos.people.records.slice(0, limit).map((person) => ({
    ...person,
    rowId: rowAnchor("person", person.id),
    dataAttrs: knowledgeDataAttrs("people", [person.name, person.login, person.publicRole, person.repositories, person.contributionSummary]),
  }));
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

export function researchRows(limit = Infinity) {
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

export function entityOrgRows(limit = Infinity) {
  return (siteData.instituteos.entities.organizations || []).slice(0, limit).map((org) => ({
    ...org,
    rowId: rowAnchor("org", org.id),
    dataAttrs: knowledgeDataAttrs("organizations", [org.name, org.type, org.description, org.tags]),
  }));
}

export function entityPeopleRows(limit = Infinity) {
  return (siteData.instituteos.entities.people || []).slice(0, limit).map((person) => ({
    ...person,
    rowId: rowAnchor("member", person.id),
    dataAttrs: knowledgeDataAttrs("members", [person.name, person.title, person.roles, person.tags]),
  }));
}

export function processRows(limit = Infinity) {
  return (siteData.instituteos.processes.records || []).slice(0, limit).map((proc) => ({
    ...proc,
    rowId: rowAnchor("process", proc.id),
    dataAttrs: knowledgeDataAttrs("processes", [proc.title, proc.category, proc.status, proc.description]),
  }));
}

export function communicationRows(limit = Infinity) {
  return (siteData.instituteos.communications.records || []).slice(0, limit).map((comm) => ({
    ...comm,
    rowId: rowAnchor("publication", comm.id),
    dataAttrs: knowledgeDataAttrs("publications", [comm.title, comm.type, comm.date, comm.author]),
  }));
}

export function policyRows(limit = Infinity) {
  return (siteData.instituteos.policies.records || []).slice(0, limit).map((pol) => ({
    ...pol,
    rowId: rowAnchor("policy", pol.id),
    dataAttrs: knowledgeDataAttrs("policies", [pol.title, pol.category, pol.status, pol.description, pol.tags]),
  }));
}
