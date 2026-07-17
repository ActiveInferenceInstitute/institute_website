import { siteData, pageBySlug } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, title_case_token_js } from "../lib/text.mjs";
import { slugToHref } from "../render/urls.mjs";
import { sectionHeading } from "../render/components.mjs";

// Registry-backed program catalog for /programs/. The page prose remains
// editorial, while this section makes the structured program source complete
// and discoverable as new pathways are added to InstituteOS.
export function programCatalogSection(currentDir = "") {
  const programs = (siteData.instituteos.programs.records || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!programs.length) {
    return "";
  }
  const cards = programs.map((program) => {
    const slug = program.websiteSlug;
    const page = pageBySlug.get(slug);
    const href = page ? slugToHref(slug, currentDir) : "";
    const title = escapeHtml(sanitizePublicProse(program.name));
    const cardBody = `<span>${escapeHtml(title_case_token_js(program.category || "program"))}</span>
        <strong>${title}</strong>
        <p>${escapeHtml(sanitizePublicProse(program.summary || program.description || ""))}</p>
        <em>${escapeHtml((program.topics || []).slice(0, 4).map(title_case_token_js).join(", "))}</em>`;
    return href
      ? `<a class="resource-card internal-card" href="${escapeHtml(href)}">${cardBody}</a>`
      : `<article class="resource-card">${cardBody}</article>`;
  }).join("");
  return `<section class="content-band" id="program-catalog">
    ${sectionHeading({
      eyebrow: "Registry-backed pathways",
      title: `All ${programs.length} Institute programs`,
      text: "This catalog is generated from the InstituteOS program registry. Open the detailed public page when one exists, or use the program summary as an orientation point.",
    })}
    <div class="resource-grid compact-grid">${cards}</div>
  </section>`;
}
