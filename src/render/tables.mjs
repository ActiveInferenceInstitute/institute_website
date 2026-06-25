import { escapeHtml, sanitizePublicProse, title_case_token_js } from "../lib/text.mjs";
import {
  peopleRows,
  projectRows,
  ideaRows,
  ontologyRows,
  researchRows,
  entityOrgRows,
  entityPeopleRows,
  processRows,
  communicationRows,
  policyRows,
} from "../lib/instituteos.mjs";
import { sectionHeading } from "./components.mjs";
import { sourceAnchor } from "./sources.mjs";
import { listText } from "./text.mjs";
import { isVerifiedExternalUrl } from "./urls.mjs";

// Governance board-status badge — a solid pill tinted by the board-status token
// through the design-system .ds-status-<slug> utility class. Class-only (no inline
// style) to stay inside the strict style-src 'self' CSP. Matches the design-system
// StatusBadge component's appearance, sourced from the same tokens.
function statusBadge(status) {
  const raw = String(status || "");
  if (!raw) return "";
  const slug = raw.toLowerCase().replace(/_/g, "-");
  return `<span class="ds-badge ds-badge--solid ds-status-${escapeHtml(slug)}">${escapeHtml(title_case_token_js(raw))}</span>`;
}

// Policy-category chip — a .ds-tag tinted by the policy-category token, mirroring
// the design-system CategoryChip. Class-only for CSP safety.
function categoryTag(category) {
  const raw = String(category || "");
  if (!raw) return "";
  const slug = raw.toLowerCase().replace(/_/g, "-");
  return `<span class="ds-tag ds-category-${escapeHtml(slug)}">${escapeHtml(title_case_token_js(raw.replace(/_/g, " ")))}</span>`;
}

export function tableRows(items, columns) {
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

export function tableHead(columns) {
  return columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
}

export function dataTable({ caption, columns, rows, className = "directory-table" }) {
  return `<div class="table-wrap"><table class="${className}">
    <caption>${escapeHtml(caption)}</caption>
    <thead><tr>${tableHead(columns)}</tr></thead>
    <tbody>${tableRows(rows, columns)}</tbody>
  </table></div>`;
}

export function tableSection({ id, eyebrow, title, text, countLabel, tableHtml }) {
  return `<section class="content-band" id="${escapeHtml(id)}">
    ${sectionHeading({ eyebrow, title, text })}
    <p class="category-count" data-knowledge-count="${escapeHtml(id)}">${escapeHtml(countLabel)}</p>
    ${tableHtml}
  </section>`;
}

export function peopleTable(rows = peopleRows()) {
  const columns = [
    { label: "Public person", render: (item) => sourceAnchor(item.sourceId, item.name) },
    { label: "GitHub", render: (item) => escapeHtml(`@${item.login}`) },
    { label: "Public basis", render: (item) => escapeHtml(item.publicRole) },
    { label: "Visible repositories", render: (item) => escapeHtml(listText(item.repositories)) },
    { label: "Summary", render: (item) => escapeHtml(item.contributionSummary) },
  ];
  return dataTable({ caption: "Public GitHub people visible in ActiveInferenceInstitute open-source metadata.", columns, rows });
}

export function projectsTable(rows = projectRows()) {
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

export function ideasTable(rows = ideaRows()) {
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

export function ontologyTable(rows = ontologyRows()) {
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

export function researchTable(rows = researchRows()) {
  const columns = [
    { label: "Research link", render: (item) => sourceAnchor(item.sourceId, item.label) },
    { label: "Group", render: (item) => escapeHtml(item.categoryLabel) },
    { label: "Audience", render: (item) => escapeHtml(item.audienceLabel) },
    { label: "Summary", render: (item) => escapeHtml(item.summary) },
    { label: "Tags", render: (item) => escapeHtml(listText(item.tags)) },
  ];
  return dataTable({ caption: "Verified public research, paper, and reference links.", columns, rows });
}

export function organizationsTable(rows = entityOrgRows()) {
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

export function governanceMembersTable(rows = entityPeopleRows()) {
  const columns = [
    { label: "Name", render: (item) => escapeHtml(item.name) },
    { label: "Title", render: (item) => escapeHtml(item.title || "") },
    { label: "Roles", render: (item) => escapeHtml((item.roles || []).join(" · ")) },
    { label: "Active", render: (item) => (item.active ? "Yes" : "No") },
  ];
  return dataTable({ caption: "Public governance members in the Active Inference Institute registry.", columns, rows });
}

export function processesTable(rows = processRows()) {
  const columns = [
    { label: "Process", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.title)}</a>` },
    { label: "Category", render: (item) => categoryTag(item.category) },
    { label: "Status", render: (item) => statusBadge(item.status) },
    { label: "Steps", render: (item) => String(item.stepCount || 0) },
    { label: "SLA days", render: (item) => item.slaDays != null ? String(item.slaDays) : "—" },
    { label: "Description", render: (item) => escapeHtml(sanitizePublicProse(item.description || "").slice(0, 120)) },
  ];
  return dataTable({ caption: "Public governance process descriptions from the Active Inference Institute.", columns, rows });
}

export function publicationsTable(rows = communicationRows()) {
  const columns = [
    { label: "Title", render: (item) => escapeHtml(item.title) },
    { label: "Type", render: (item) => escapeHtml(title_case_token_js(item.type || "")) },
    { label: "Date", render: (item) => escapeHtml((item.date || "").slice(0, 10)) },
    { label: "Author", render: (item) => escapeHtml(item.author || "") },
    { label: "Reference", render: (item) => escapeHtml(item.referenceNumber || "") },
  ];
  return dataTable({ caption: "Approved public communications from the Active Inference Institute.", columns, rows });
}

export function policiesTable(rows = policyRows()) {
  const columns = [
    { label: "Policy", render: (item) => `<a href="#${escapeHtml(item.rowId)}">${escapeHtml(item.title)}</a>` },
    { label: "Category", render: (item) => categoryTag(item.category) },
    { label: "Status", render: (item) => statusBadge(item.status) },
    { label: "Version", render: (item) => escapeHtml(item.currentVersion || "") },
    { label: "Description", render: (item) => escapeHtml(sanitizePublicProse(item.description || "").slice(0, 120)) },
    { label: "Tags", render: (item) => escapeHtml(listText(item.tags)) },
  ];
  return dataTable({ caption: "Public governance policy registry for the Active Inference Institute.", columns, rows });
}
