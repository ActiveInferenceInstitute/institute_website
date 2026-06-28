import { escapeHtml, slugifyAnchor } from "../lib/text.mjs";
import { hrefForSlug, stripLocalePrefix } from "../url-taxonomy.mjs";
import { tr } from "../i18n/index.mjs";
import { linkChips, linkList } from "./page-sections.mjs";
import { cardIcon } from "./icons.mjs";

// These shared components translate their text inputs centrally, so every call
// site across the site (dozens of literal eyebrows/titles) becomes localized
// from a single place. Each input is the English source string; tr() returns the
// active-locale translation or falls back to English.
export function sectionHeading({ eyebrow, title, text }) {
  const parts = ['<div class="section-heading">'];
  if (eyebrow) {
    parts.push(`    <p class="eyebrow">${escapeHtml(tr(eyebrow))}</p>`);
  }
  parts.push(`    <h2>${escapeHtml(tr(title))}</h2>`);
  if (text) {
    parts.push(`    <p>${escapeHtml(tr(text))}</p>`);
  }
  parts.push("  </div>");
  return parts.join("\n");
}

export function cardGrid(cards = [], currentDir = "") {
  return `<div class="card-grid">${cards
    .map((card) => {
      const links = linkChips(card.links, currentDir);
      const icon = cardIcon(card.icon);
      // Icon (when present) and heading share a flex header row so the glyph
      // sits in a small accent badge to the left of the title.
      const header = icon
        ? `<div class="card-head"><span class="card-icon-badge">${icon}</span><h3>${escapeHtml(tr(card.title))}</h3></div>`
        : `<h3>${escapeHtml(tr(card.title))}</h3>`;
      return `<article class="info-card${icon ? " has-icon" : ""}">
        ${header}
        <p>${escapeHtml(tr(card.text))}</p>${links ? `\n        ${links}` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

export function breadcrumb(page, currentDir = "") {
  // Derive the real parent section from the URL so the visible trail matches the
  // BreadcrumbList JSON-LD (which uses the same URL-section logic). Two-segment
  // pages (projects/x, programs/x) get a section crumb; top-level pages don't.
  // Infer the parent section from the locale-agnostic base dir so a locale
  // prefix (e.g. "zh/") is never mistaken for a section slug.
  const parts = stripLocalePrefix(currentDir).split("/").filter(Boolean);
  let parentLink = "";
  if (parts.length >= 2) {
    const section = parts[0];
    const label = section.charAt(0).toUpperCase() + section.slice(1);
    parentLink = `<a href="${hrefForSlug(section, currentDir)}">${escapeHtml(tr(label))}</a>
    <span aria-hidden="true">/</span>
    `;
  }
  return `<nav class="breadcrumb" aria-label="${escapeHtml(tr("Breadcrumb"))}">
    <a href="${hrefForSlug("index", currentDir)}">${escapeHtml(tr("Home"))}</a>
    <span aria-hidden="true">/</span>
    ${parentLink}<span aria-current="page">${escapeHtml(tr(page.title))}</span>
  </nav>`;
}

export function pageGuide(page, currentDir = "") {
  const sectionLinks = page.sections
    .map((section) => `<a href="#${escapeHtml(slugifyAnchor(section.heading))}">${escapeHtml(tr(section.heading))}</a>`)
    .join("");
  return `<section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">${escapeHtml(tr("On this page"))}</p>
        <h2>${escapeHtml(tr(page.title))} ${escapeHtml(tr("guide"))}</h2>
      </div>
      <nav aria-label="${escapeHtml(tr(page.title))} ${escapeHtml(tr("page sections"))}">
        ${sectionLinks}
        <a href="#next-actions">${escapeHtml(tr("Best next actions"))}</a>
        <a href="#key-surfaces">${escapeHtml(tr("Key surfaces"))}</a>
        <a href="${hrefForSlug("knowledge", currentDir)}">${escapeHtml(tr("Open Source Map"))}</a>
        <a href="#resources">${escapeHtml(tr("Related resources"))}</a>
        <a href="#official-pages">${escapeHtml(tr("Official pages"))}</a>
        <a href="#repositories">${escapeHtml(tr("Repositories"))}</a>
        <a href="#related-pages">${escapeHtml(tr("Related pages"))}</a>
      </nav>
    </div>
  </section>`;
}
