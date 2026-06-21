import { siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { slugToHref } from "./urls.mjs";

export function publicPagePager(page, currentDir = "") {
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  const prev = siteData.pages[index - 1];
  const next = siteData.pages[index + 1];
  return `<nav class="pager page-pager" aria-label="${escapeHtml(page.title)} adjacent pages">
    ${prev ? `<a href="${slugToHref(prev.slug, currentDir)}">Previous: ${escapeHtml(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${slugToHref(next.slug, currentDir)}">Next: ${escapeHtml(next.title)}</a>` : "<span></span>"}
  </nav>`;
}
