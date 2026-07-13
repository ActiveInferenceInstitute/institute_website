import { loadProjectsData, siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, title_case_token_js } from "../lib/text.mjs";
import { slugToHref } from "../render/urls.mjs";
import { sectionHeading } from "../render/components.mjs";

// Map a data/projects.json project id to its generated page slug. Prefers the
// explicit website_slug; falls back to the conventional project-<id> form when a
// page exists.
export const projectDataById = new Map((loadProjectsData().projects || []).map((project) => [project.id, project]));
export function projectPageSlugForDataId(dataId) {
  const project = projectDataById.get(dataId);
  if (project && project.website_slug) {
    return project.website_slug;
  }
  return `project-${dataId}`;
}

// "Related projects" for a project page: projects sharing category and/or
// topics, ranked by overlap, restricted to those with a real public page.
export function relatedProjectsForPage(page) {
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

// Full project catalog: every public project that has a real website page
// (website_slug set), generated directly from data/projects.json. Exists so the
// /projects landing page surfaces the complete registry instead of only the
// hand-curated subset named in the page's own "sections" prose — before this,
// only 21 of 61 public project pages were linked from /projects/, leaving the
// rest reachable solely through /directory/ or another page's related-projects
// panel. New/removed registry entries appear here automatically on next export
// + build, no hand-authored link needed.
export function catalogProjects() {
  return (loadProjectsData().projects || [])
    .filter((project) => project && project.website_slug)
    .map((project) => ({
      id: project.id,
      title: project.title || project.id,
      status: project.status || "unknown",
      summary: project.summary || project.description || "",
      topics: project.topics || [],
      slug: project.website_slug,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function projectCatalogSection(currentDir = "") {
  const projects = catalogProjects();
  if (!projects.length) {
    return "";
  }
  const activeCount = projects.filter((project) => project.status === "active").length;
  const archivedCount = projects.length - activeCount;
  const cards = projects
    .map((project) => {
      const topics = project.topics
        .slice(0, 4)
        .map((topic) => escapeHtml(title_case_token_js(topic)))
        .join(", ");
      const summary = sanitizePublicProse(project.summary).slice(0, 160);
      const search = escapeHtml(`${project.title} ${project.summary} ${project.topics.join(" ")}`.toLowerCase());
      const statusLabel = project.status === "active" ? "Active" : title_case_token_js(project.status);
      return `<a class="resource-card internal-card catalog-project-card" href="${slugToHref(project.slug, currentDir)}" data-catalog-row data-status="${escapeHtml(project.status)}" data-search="${search}">
        <span>${escapeHtml(statusLabel)}</span>
        <strong>${escapeHtml(sanitizePublicProse(project.title))}</strong>
        <p>${escapeHtml(summary)}</p>
        ${topics ? `<em>${topics}</em>` : ""}
      </a>`;
    })
    .join("");
  return `<section class="content-band" id="project-catalog">
    ${sectionHeading({
      eyebrow: "Full catalog",
      title: `Browse all ${projects.length} public projects`,
      text: "Every Institute and Ecosystem project with a public page, generated directly from the InstituteOS project registry export. Search by name or topic, or filter by status.",
    })}
    <div class="activities-search">
      <input id="project-catalog-search" type="search" placeholder="Search ${projects.length} projects by name or topic…" autocomplete="off" aria-label="Search all projects">
      <select id="project-catalog-status" aria-label="Filter projects by status">
        <option value="">All statuses (${projects.length})</option>
        <option value="active">Active (${activeCount})</option>
        <option value="archived">Archived (${archivedCount})</option>
      </select>
      <span id="project-catalog-count" aria-live="polite"></span>
    </div>
    <div class="resource-grid compact-grid" id="project-catalog-grid">${cards}</div>
  </section>`;
}

export function relatedProjectsSection(page, currentDir = "") {
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
