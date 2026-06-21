import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, proseParagraphs, slugifyAnchor } from "../lib/text.mjs";
import { sectionHeading } from "./components.mjs";

// Narrative entries sanitized and grouped for a given target page. Bodies are
// transposed public Institute prose; markdown/links/PII are scrubbed at render.
export function narrativesForTarget(targetPage) {
  return (siteData.instituteos.narratives.narratives || [])
    .filter((entry) => entry.target_page === targetPage)
    .map((entry) => ({
      section: entry.section,
      title: sanitizePublicProse(entry.title || entry.section || ""),
      paragraphs: proseParagraphs(entry.body || ""),
    }))
    .filter((entry) => entry.paragraphs.length > 0);
}

// Render a narrative collection as one content-band with stacked prose blocks.
export function narrativeSection({ id, eyebrow, title, text, targetPage }) {
  const entries = narrativesForTarget(targetPage);
  if (!entries.length) {
    return "";
  }
  const blocks = entries
    .map((entry) => {
      const paras = entry.paragraphs.map((para) => `<p>${escapeHtml(para)}</p>`).join("\n            ");
      return `<article class="article-block" id="${escapeHtml(slugifyAnchor(`narrative-${entry.section}-${entry.title}`))}">
            <h3>${escapeHtml(entry.title)}</h3>
            ${paras}
          </article>`;
    })
    .join("\n          ");
  return `<section class="content-band" id="${escapeHtml(id)}">
    ${sectionHeading({ eyebrow, title, text })}
    <div class="article-stack">
          ${blocks}
    </div>
  </section>`;
}
