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
