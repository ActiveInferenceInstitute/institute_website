import { siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { slugToHref } from "./urls.mjs";
import { tr } from "../i18n/index.mjs";

export function publicPagePager(page, currentDir = "") {
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  const prev = siteData.pages[index - 1];
  const next = siteData.pages[index + 1];
  // Titles are already localized by the caller; the label patterns are
  // build-time tr() strings with a {title} placeholder.
  return `<nav class="pager page-pager" aria-label="${escapeHtml(tr("{title} adjacent pages").replace("{title}", page.title))}">
    ${prev ? `<a href="${slugToHref(prev.slug, currentDir)}">${escapeHtml(tr("Previous: {title}").replace("{title}", prev.title))}</a>` : "<span></span>"}
    ${next ? `<a href="${slugToHref(next.slug, currentDir)}">${escapeHtml(tr("Next: {title}").replace("{title}", next.title))}</a>` : "<span></span>"}
  </nav>`;
}
