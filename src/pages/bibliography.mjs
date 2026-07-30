import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../lib/text.mjs";
import { sectionHeading } from "../render/components.mjs";

const _dir = path.dirname(fileURLToPath(import.meta.url));
const bibPath = path.join(_dir, "..", "content", "bibliography.json");

/**
 * Render the bibliography citation list as an HTML section.
 * Injected into the bibliography page via feature-sections.mjs.
 */
export function renderBibliographyList() {
  if (!fs.existsSync(bibPath)) {
    return `<section class="content-band" id="citations">
      ${sectionHeading({
        eyebrow: "Bibliography",
        title: "Citation data not yet generated",
        text: "Run scripts/generate_bibliography.py to generate the bibliography data file.",
      })}
    </section>`;
  }

  const bib = JSON.parse(fs.readFileSync(bibPath, "utf8"));
  const sections = bib.sections || [];

  let html = "";
  for (const section of sections) {
    if (!section.entries || !section.entries.length) continue;
    const entries = section.entries;
    html += `
    <div class="bib-section">
      <h3>${escapeHtml(section.title)}</h3>
      <ul class="bib-list">
        ${entries
          .map((entry) => {
            const url = entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : "");
            const titleLink = url
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title || "Untitled")}</a>`
              : escapeHtml(entry.title || "Untitled");
            const meta = [
              entry.authors ? escapeHtml(entry.authors) : "",
              entry.year ? `(${escapeHtml(entry.year)})` : "",
            ]
              .filter(Boolean)
              .join(" ");
            const venue = [
              entry.journal ? `<em>${escapeHtml(entry.journal)}</em>` : "",
              entry.volume ? escapeHtml(entry.volume) : "",
              entry.number ? `(${escapeHtml(entry.number)})` : "",
              entry.pages ? escapeHtml(entry.pages) : "",
            ]
              .filter(Boolean)
              .join(", ");
            const extra = [entry.publisher ? escapeHtml(entry.publisher) : "", entry.doi ? `DOI: ${escapeHtml(entry.doi)}` : ""]
              .filter(Boolean)
              .join(" · ");
            return `<li class="bib-entry">
              <span class="bib-title">${titleLink}</span>
              <span class="bib-meta">${meta}</span>
              ${venue ? `<span class="bib-venue">${venue}.</span>` : ""}
              ${extra ? `<span class="bib-extra">${extra}</span>` : ""}
            </li>`;
          })
          .join("\n        ")}
      </ul>
    </div>`;
  }

  return `<section class="content-band" id="citations">
    ${sectionHeading({
      eyebrow: "Full bibliography",
      title: `${bib.total_entries} references in ${sections.length} sections`,
      text: "Every reference is linked to its DOI or source URL. The BibTeX source is available on GitHub.",
    })}
    ${html}
  </section>`;
}
