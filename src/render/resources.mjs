import { pageBySlug } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { linkAttrs } from "./links.mjs";
import { slugToHref } from "./urls.mjs";

export function resourceBadge(resource) {
  const parts = [resource.typeLabel].filter(Boolean);
  if (resource.categoryLabel && resource.categoryLabel !== resource.typeLabel) {
    parts.push(resource.categoryLabel);
  }
  return parts.join(" / ");
}

export function resourceCards(resources = [], { compact = false, filterable = true, sortable = false, wrapperAttrs = "", currentDir = "" } = {}) {
  if (!resources.length) {
    return '<p class="lede">No public resources are assigned here yet. Use the global directory for the full verified list.</p>';
  }
  const className = compact ? "resource-grid compact-grid" : "resource-grid";
  return `<div class="${className}"${wrapperAttrs}>${resources
    .map((resource) => {
      const related = (resource.relatedSlugs || [])
        .map((slug) => pageBySlug.get(slug))
        .filter(Boolean)
        .map((page) => `<a href="${slugToHref(page.slug, currentDir)}">${escapeHtml(page.title)}</a>`)
        .join("");
      const search = [
        resource.label,
        resource.typeLabel,
        resource.categoryLabel,
        resource.audienceLabel,
        resource.summary,
        resource.tags.join(" "),
        resource.language || "",
      ]
        .join(" ")
        .toLowerCase();
      const tagList = resource.tags.length
        ? `<div class="tag-row">${resource.tags.slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";
      const repoMeta =
        resource.sourceKind === "repository"
          ? `<p class="resource-meta">${escapeHtml(resource.language || "Unspecified")} / ${Number(resource.stars || 0)} stars / updated ${escapeHtml((resource.updatedAt || "").slice(0, 10))}</p>`
          : "";
      const filterAttrs = filterable
        ? ` data-type="${escapeHtml(resource.type)}" data-category="${escapeHtml(resource.category)}" data-audience="${escapeHtml(resource.audience)}" data-tags="${escapeHtml(resource.tags.join(" "))}" data-search="${escapeHtml(search)}"`
        : "";
      const sortAttrs = sortable
        ? ` data-repo-card data-repo-label="${escapeHtml(resource.label.toLowerCase())}" data-repo-stars="${Number(resource.stars || 0)}" data-repo-updated="${escapeHtml(resource.updatedAt || "")}" data-repo-language="${escapeHtml((resource.language || "Unspecified").toLowerCase())}" data-repo-category="${escapeHtml(resource.categoryLabel.toLowerCase())}"`
        : "";
      return `<article class="resource-card"${filterAttrs}${sortAttrs}>
        <span class="resource-kicker">${escapeHtml(resourceBadge(resource))}</span>
        <h3><a href="${escapeHtml(resource.href)}"${linkAttrs(resource.href)}>${escapeHtml(resource.label)}</a></h3>
        <p class="resource-audience">Audience: ${escapeHtml(resource.audienceLabel)}</p>
        <p>${escapeHtml(resource.summary)}</p>
        ${repoMeta}
        ${tagList}
        ${related ? `<div class="mini-links" aria-label="Related pages">${related}</div>` : ""}
      </article>`;
    })
    .join("")}</div>`;
}
