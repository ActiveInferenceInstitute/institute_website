import { hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { siteData } from "../data.mjs";
import { tr } from "../i18n/index.mjs";
import { sectionHeading } from "./components.mjs";

// Compact "Active Inference across domains" link band. Placed on the
// highest-authority pages (home, Open Source Map, resources) so every
// /active-inference/<topic>/ page has strong internal links pointing in —
// GSC (2026-07) showed the domain pages sitting in "discovered, not crawled"
// for lack of inbound paths beyond their own hub. Slugs are derived from the
// curated page set (prefix contract shared with url-taxonomy routing), never
// hardcoded, so a new domain page joins the band automatically.
const DOMAIN_SLUG_PREFIX = "active-inference-and-";

export function domainPages() {
  return siteData.pages
    .filter((page) => page.slug.startsWith(DOMAIN_SLUG_PREFIX))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
}

function shortDomainLabel(page) {
  // "Active Inference and Agriculture" -> "Agriculture"; fall back to the
  // full title when a page breaks the naming convention.
  const marker = " and ";
  const idx = page.title.indexOf(marker);
  return idx > 0 ? page.title.slice(idx + marker.length) : page.title;
}

export function domainsSection(currentDir) {
  const pages = domainPages();
  if (pages.length === 0) {
    return "";
  }
  const links = pages
    .map(
      (page) =>
        `<a href="${escapeHtml(hrefForSlug(page.slug, currentDir))}">${escapeHtml(tr(shortDomainLabel(page)))}</a>`,
    )
    .join("");
  return `
  <section class="content-band" id="domains">
    ${sectionHeading({ eyebrow: tr("Domains"), title: tr("Active Inference across domains") })}
    <p>${escapeHtml(tr("Explorable overviews of how Active Inference is applied across scientific and practical domains — each with orientation, key ideas, and entry points into related projects and resources."))}</p>
    <div class="mini-links">${links}<a href="${escapeHtml(hrefForSlug("active-inference", currentDir))}">${escapeHtml(tr("All domains"))}</a></div>
  </section>`;
}
