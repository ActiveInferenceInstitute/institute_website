import { loadProjectsData, siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, slugifyAnchor, title_case_token_js } from "../lib/text.mjs";
import { slugToHref } from "../render/urls.mjs";
import { sectionHeading } from "../render/components.mjs";
import { linkChips } from "../render/page-sections.mjs";
import { tr } from "../i18n/index.mjs";

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

// Reverse lookup, keyed by the generated page slug rather than the registry
// id, so a project detail page can look up its own registry status without
// knowing its own dataId. Backs the archived-status notice below: the notice
// text is never hand-authored per page, it is always derived from this field,
// so it can't drift out of sync with library/registries/projects.json.
export const projectDataBySlug = new Map(
  (loadProjectsData().projects || []).filter((project) => project.website_slug).map((project) => [project.website_slug, project]),
);
export function projectStatusForSlug(slug) {
  return projectDataBySlug.get(slug)?.status || null;
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
    .map((project) => {
      if (project.affiliation !== "institute" && project.affiliation !== "ecosystem") {
        throw new Error(`Project ${project.id || "<unknown>"} has no valid public affiliation`);
      }
      return {
      id: project.id,
      title: project.title || project.id,
      status: project.status || "unknown",
      affiliation: project.affiliation,
      summary: project.summary || project.description || "",
      topics: project.topics || [],
      owner: project.owner_name || "",
      people: Array.isArray(project.people) ? project.people : [],
      slug: project.website_slug,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

// Top-N most common topics across the catalog, for the topic <select>. Only
// topics shared by >1 project are worth a filter option; everything else stays
// reachable through free-text search.
function topCatalogTopics(projects, limit = 14) {
  const counts = new Map();
  for (const project of projects) {
    for (const topic of project.topics) {
      const key = String(topic).toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

function catalogProjectCard(project, currentDir) {
  const topics = project.topics
    .slice(0, 4)
    .map((topic) => escapeHtml(title_case_token_js(topic)))
    .join(", ");
  const topicKeys = escapeHtml(project.topics.map((topic) => String(topic).toLowerCase()).join(" "));
  const summary = sanitizePublicProse(project.summary).slice(0, 160);
  const search = escapeHtml(
    `${project.title} ${project.summary} ${project.topics.join(" ")} ${project.owner} ${(project.people || []).map((person) => person.name).join(" ")}`.toLowerCase(),
  );
  const statusLabel = project.status === "active" ? "Active" : title_case_token_js(project.status);
  const lead = project.owner ? `<em class="catalog-lead">Lead: ${escapeHtml(sanitizePublicProse(project.owner))}</em>` : "";
  const people = (project.people || []).slice(0, 3).map((person) => sanitizePublicProse(person.name || "")).filter(Boolean);
  const peopleLabel = people.length ? `<em class="catalog-people">People: ${escapeHtml(people.join(", "))}</em>` : "";
  const affiliationLabel = project.affiliation === "ecosystem" ? "Ecosystem" : "Institute-hosted";
  return `<a class="resource-card internal-card catalog-project-card" href="${slugToHref(project.slug, currentDir)}" data-catalog-row data-affiliation="${escapeHtml(project.affiliation)}" data-status="${escapeHtml(project.status)}" data-topics="${topicKeys}" data-search="${search}">
        <span>${escapeHtml(affiliationLabel)} · ${escapeHtml(statusLabel)}</span>
        <strong>${escapeHtml(sanitizePublicProse(project.title))}</strong>
        <p>${escapeHtml(summary)}</p>
        ${topics ? `<em>${topics}</em>` : ""}
        ${lead}
        ${peopleLabel}
      </a>`;
}

export function projectCatalogSection(currentDir = "") {
  const projects = catalogProjects();
  if (!projects.length) {
    return "";
  }
  const topics = topCatalogTopics(projects);
  const topicOptions = topics
    .map(({ topic, count }) => `<option value="${escapeHtml(topic)}">${escapeHtml(title_case_token_js(topic))} (${count})</option>`)
    .join("");
  const groups = [
    { key: "institute", title: "Institute-hosted projects", anchor: "institute-projects" },
    { key: "ecosystem", title: "Ecosystem projects", anchor: "ecosystem-projects" },
  ];
  const sections = groups.map(({ key, title, anchor }) => {
    const group = projects.filter((project) => project.affiliation === key);
    const active = group.filter((project) => project.status === "active");
    const archived = group.filter((project) => project.status !== "active");
    const renderStatus = (items, status, label, suffix) => items.length
      ? `<div class="catalog-subhead"><h4>${label}</h4><span class="catalog-subcount" id="${anchor}-${suffix}-count">${items.length} project${items.length === 1 ? "" : "s"}</span></div><div class="resource-grid compact-grid" id="${anchor}-${suffix}-grid">${items.map((project) => catalogProjectCard(project, currentDir)).join("")}</div><p class="catalog-empty" id="${anchor}-${suffix}-empty" hidden>No ${status} ${key} projects match your search.</p>`
      : "";
    return `<section class="catalog-affiliation" id="${anchor}" data-affiliation="${key}">
      <div class="catalog-subhead"><h3>${title}</h3><span class="catalog-subcount">${group.length} project${group.length === 1 ? "" : "s"}</span></div>
      ${renderStatus(active, "active", "Active projects", "active")}
      ${renderStatus(archived, "archived or completed", "Archived &amp; completed projects", "archived")}
    </section>`;
  }).join("");
  return `<section class="content-band" id="project-catalog">
    ${sectionHeading({
      eyebrow: "Full catalog",
      title: `Browse all ${projects.length} public projects`,
      text: "Projects are classified by the canonical InstituteOS affiliation field: Institute-hosted or Ecosystem. Active and archived work remain distinct within each section. Search by name, topic, or lead, or narrow by topic.",
    })}
    <div class="activities-search">
      <input id="project-catalog-search" type="search" placeholder="Search ${projects.length} projects by name, topic, or lead…" autocomplete="off" aria-label="Search all projects">
      <select id="project-catalog-topic" aria-label="Filter projects by topic">
        <option value="">All topics</option>
        ${topicOptions}
      </select>
      <span id="project-catalog-count" aria-live="polite"></span>
    </div>
    ${sections}
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

// Course syllabus grid — an optional `page.syllabus` block ({ heading, intro,
// items: [{ title, meta, body, links }] }) rendered as a scannable card grid
// near the top of a project page, instead of one full-width prose section per
// session. Opt-in: pages without `syllabus` render nothing.
export function syllabusGrid(entry, currentDir = "") {
  if (!entry || !Array.isArray(entry.items) || !entry.items.length) {
    return "";
  }
  const cards = entry.items
    .map((item) => {
      const meta = item.meta ? `<span class="resource-kicker">${escapeHtml(tr(item.meta))}</span>` : "";
      const links = linkChips(item.links, currentDir);
      return `<article class="resource-card" id="${escapeHtml(slugifyAnchor(item.title))}">
        ${meta}
        <h3>${escapeHtml(tr(item.title))}</h3>
        <p>${escapeHtml(tr(item.body))}</p>
        ${links}
      </article>`;
    })
    .join("");
  return `<section class="content-band" id="${escapeHtml(slugifyAnchor(entry.heading))}">
    ${sectionHeading({ eyebrow: tr(entry.eyebrow || "Course schedule"), title: tr(entry.heading), text: tr(entry.intro || "") })}
    <div class="resource-grid compact-grid">${cards}</div>
  </section>`;
}

// Course Q&A grid — an optional `page.qanda` block, same shape as `syllabus`.
// Each card is a native <details>/<summary> disclosure (collapsed by
// default) so a large question bank stays compact and secondary to the
// syllabus, without dropping any content.
export function qaGrid(entry, currentDir = "") {
  if (!entry || !Array.isArray(entry.items) || !entry.items.length) {
    return "";
  }
  const cards = entry.items
    .map((item) => {
      const links = linkChips(item.links, currentDir);
      return `<article class="resource-card">
        <details>
          <summary>${escapeHtml(tr(item.title))}</summary>
          <p>${escapeHtml(tr(item.body))}</p>
          ${links}
        </details>
      </article>`;
    })
    .join("");
  return `<section class="content-band muted" id="${escapeHtml(slugifyAnchor(entry.heading))}">
    ${sectionHeading({ eyebrow: tr(entry.eyebrow || "Q&A"), title: tr(entry.heading), text: tr(entry.intro || "") })}
    <div class="resource-grid compact-grid">${cards}</div>
  </section>`;
}
