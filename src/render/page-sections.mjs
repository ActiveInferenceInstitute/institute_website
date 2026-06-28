import { siteData } from "../data.mjs";
import { escapeHtml, slugifyAnchor } from "../lib/text.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";
import { tr } from "../i18n/index.mjs";
import { linkAttrs, resolveLink, resolveLinks } from "./links.mjs";
import { resolveInternalHref } from "./urls.mjs";

export function nav(currentDir = "") {
  const groups = siteData.navigation
    .map((group, index) => {
      // The DOM id is derived from the stable English label so anchors stay
      // identical across locales; only the visible text is translated.
      const id = `nav-menu-${index}-${slugifyAnchor(group.label)}`;
      const items = (group.items || [])
        .map((item) => `<a href="${escapeHtml(hrefForSlug(item.slug, currentDir, item.anchor || ""))}">${escapeHtml(tr(item.label))}</a>`)
        .join("");
      return `<div class="nav-group">
        <button class="nav-menu-button" type="button" aria-expanded="false" aria-controls="${id}" data-nav-toggle>
          <span>${escapeHtml(tr(group.label))}</span>
          <span aria-hidden="true">+</span>
        </button>
        <div class="nav-menu" id="${id}">${items}</div>
      </div>`;
    })
    .join("");
  return `<nav class="nav" aria-label="${escapeHtml(tr("Primary"))}">${groups}</nav>`;
}

export function socialLinks() {
  return siteData.social
    .map((item) => resolveLink(item))
    .filter(Boolean)
    .map((link) => `<a href="${escapeHtml(link.href)}"${linkAttrs(link.href)}>${escapeHtml(link.label)}</a>`)
    .join("");
}

export function actionButtons(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="hero-actions">${resolved
    .map((link, index) => {
      const kind = index === 0 ? "primary" : "secondary";
      const href = resolveInternalHref(link.href, currentDir);
      return `<a class="button ${kind}" href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}

export function linkChips(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="link-chips">${resolved
    .map((link) => {
      const meta = link.meta ? `<em>${escapeHtml(link.meta)}</em>` : "";
      const href = resolveInternalHref(link.href, currentDir);
      return `<a href="${escapeHtml(href)}"${linkAttrs(href)}><span>${escapeHtml(link.label)}</span>${meta}</a>`;
    })
    .join("")}</div>`;
}

export function linkList(links = [], currentDir = "") {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="mini-links">${resolved
    .map((link) => {
      const href = resolveInternalHref(link.href, currentDir);
      return `<a href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}
