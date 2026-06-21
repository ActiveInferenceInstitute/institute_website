import { escapeHtml, slugifyAnchor } from "../lib/text.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";
import { linkChips, linkList } from "./page-sections.mjs";

export function sectionHeading({ eyebrow, title, text }) {
  const parts = ['<div class="section-heading">'];
  if (eyebrow) {
    parts.push(`    <p class="eyebrow">${escapeHtml(eyebrow)}</p>`);
  }
  parts.push(`    <h2>${escapeHtml(title)}</h2>`);
  if (text) {
    parts.push(`    <p>${escapeHtml(text)}</p>`);
  }
  parts.push("  </div>");
  return parts.join("\n");
}

export function cardGrid(cards = [], currentDir = "") {
  return `<div class="card-grid">${cards
    .map((card) => {
      const links = linkChips(card.links, currentDir);
      return `<article class="info-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>${links ? `\n        ${links}` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

export function breadcrumb(page, currentDir = "") {
  // Derive the real parent section from the URL so the visible trail matches the
  // BreadcrumbList JSON-LD (which uses the same URL-section logic). Two-segment
  // pages (projects/x, programs/x) get a section crumb; top-level pages don't.
  const parts = currentDir.split("/").filter(Boolean);
  let parentLink = "";
  if (parts.length >= 2) {
    const section = parts[0];
    const label = section.charAt(0).toUpperCase() + section.slice(1);
    parentLink = `<a href="${hrefForSlug(section, currentDir)}">${escapeHtml(label)}</a>
    <span aria-hidden="true">/</span>
    `;
  }
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="${hrefForSlug("index", currentDir)}">Home</a>
    <span aria-hidden="true">/</span>
    ${parentLink}<span aria-current="page">${escapeHtml(page.title)}</span>
  </nav>`;
}

export function pageGuide(page, currentDir = "") {
  const sectionLinks = page.sections
    .map((section) => `<a href="#${escapeHtml(slugifyAnchor(section.heading))}">${escapeHtml(section.heading)}</a>`)
    .join("");
  return `<section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">On this page</p>
        <h2>${escapeHtml(page.title)} guide</h2>
      </div>
      <nav aria-label="${escapeHtml(page.title)} page sections">
        ${sectionLinks}
        <a href="#next-actions">Best next actions</a>
        <a href="#key-surfaces">Key surfaces</a>
        <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>
        <a href="#resources">Related resources</a>
        <a href="#official-pages">Official pages</a>
        <a href="#repositories">Repositories</a>
        <a href="#related-pages">Related pages</a>
      </nav>
    </div>
  </section>`;
}
