import path from "node:path";
import { siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { localePrefix, urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { layout } from "../render/layout.mjs";
import { sectionHeading } from "../render/components.mjs";
import { resolveLink } from "../render/links.mjs";
import { newsletterBody } from "./newsletter-content.mjs";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function records() {
  return (siteData.instituteos.newsletter?.records || []).slice().sort((a, b) => {
    return `${b.date || ""}-${b.id || ""}`.localeCompare(`${a.date || ""}-${a.id || ""}`);
  });
}

export function newsletterRecords() {
  return records();
}

export function newsletterIssueDir(route) {
  return `${localePrefix()}newsletter/${route}`;
}

export function newsletterIssueOutputPath(route) {
  return `${newsletterIssueDir(route)}/index.html`;
}

export function newsletterIssueHref(route, currentDir = "") {
  let href = path.posix.relative(currentDir, newsletterIssueDir(route));
  if (!href) {
    href = "./";
  }
  return href.endsWith("/") ? href : `${href}/`;
}

function displayDate(value) {
  const date = String(value || "");
  const month = MONTHS[Number(date.slice(5, 7)) - 1] || date.slice(5, 7);
  const day = Number(date.slice(8, 10)) || "";
  return `${month} ${day}, ${date.slice(0, 4)}`.trim();
}

function typeLabel(record) {
  return record.type === "newsletter" ? "Newsletter" : "Announcement";
}

function originalLink(record, label = "Read the original on Substack ↗") {
  if (!record.url) {
    return "";
  }
  return `<a class="button secondary" href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function issueCard(record, currentDir) {
  return `<article class="info-card newsletter-card">
    <p class="eyebrow">${escapeHtml(typeLabel(record))} · ${escapeHtml(displayDate(record.date))}</p>
    <h3><a href="${escapeHtml(newsletterIssueHref(record.route, currentDir))}">${escapeHtml(record.title || "Untitled issue")}</a></h3>
    <p>Published by ${escapeHtml(record.author || "Active Inference Institute")}.</p>
    <div class="card-actions">
      <a class="button secondary" href="${escapeHtml(newsletterIssueHref(record.route, currentDir))}">Open issue page</a>
      ${originalLink(record, "Substack ↗")}
    </div>
  </article>`;
}

function publicationAction() {
  const link = resolveLink({ sourceId: "official-newsletter" });
  return link
    ? `<a class="button primary" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">Subscribe on Substack ↗</a>`
    : "";
}

export function newsletterPage() {
  const currentDir = urlDirForSlug("newsletter");
  const all = records();
  const newsletters = all.filter((record) => record.type === "newsletter");
  const announcements = all.filter((record) => record.type !== "newsletter");
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span aria-current="page">Newsletter</span></nav>
    <p class="eyebrow">Public communications archive</p>
    <h1>Newsletter</h1>
    <p>The Active Inference Institute's public newsletter archive, with ${newsletters.length} monthly issues and ${announcements.length} other announcements. Each issue has a stable page on this site and a link to the original public post.</p>
    <div class="hero-actions">${publicationAction()}</div>
  </section>
  <section class="content-band" id="newsletter-archive">
    ${sectionHeading({ eyebrow: "Monthly issues", title: "All newsletters", text: "Browse the newsletter series from newest to oldest." })}
    <div class="card-grid">${newsletters.map((record) => issueCard(record, currentDir)).join("\n")}</div>
  </section>
  ${announcements.length ? `<section class="content-band muted" id="announcements">
    ${sectionHeading({ eyebrow: "Other communications", title: "Announcements and updates", text: "Public Substack posts outside the monthly newsletter series." })}
    <div class="card-grid">${announcements.map((record) => issueCard(record, currentDir)).join("\n")}</div>
  </section>` : ""}`;
  return layout({
    title: "Newsletter",
    description: "Public archive of Active Inference Institute newsletters and announcements.",
    currentDir,
    body,
    slug: "newsletter",
  });
}

export function newsletterIssuePage(record) {
  const currentDir = newsletterIssueDir(record.route);
  const archiveHref = hrefForSlug("newsletter", currentDir);
  const external = originalLink(record);
  const tags = Array.isArray(record.tags) && record.tags.length ? `<p class="tag-list">${record.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ")}</p>` : "";
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><a href="${archiveHref}">Newsletter</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(record.title || "Issue")}</span></nav>
    <p class="eyebrow">${escapeHtml(typeLabel(record))} · ${escapeHtml(displayDate(record.date))}</p>
    <h1>${escapeHtml(record.title || "Untitled issue")}</h1>
    <p>Published ${escapeHtml(displayDate(record.date))} by ${escapeHtml(record.author || "Active Inference Institute")}.</p>
    <div class="hero-actions">${external}</div>
  </section>
  <article class="content-band" id="issue-record">
    ${sectionHeading({ eyebrow: "Full issue", title: "Newsletter content", text: "This page preserves the archived newsletter text, public links, and media." })}
    ${tags}
    <dl class="metadata-list"><div><dt>Published</dt><dd><time datetime="${escapeHtml(record.date || "")}">${escapeHtml(displayDate(record.date))}</time></dd></div><div><dt>Format</dt><dd>${escapeHtml(typeLabel(record))}</dd></div></dl>
    ${newsletterBody(record, currentDir)}
    <div class="newsletter-source">${external || "The original public post is not currently available."}</div>
  </article>`;
  return layout({
    title: record.title || "Newsletter issue",
    description: `${typeLabel(record)} published ${displayDate(record.date)} by the Active Inference Institute.`,
    currentDir,
    canonicalPath: newsletterIssueOutputPath(record.route),
    body,
    slug: "newsletter",
  });
}

export function newsletterIssuePages() {
  return records().map((record) => ({
    route: record.route,
    render: () => newsletterIssuePage(record),
  }));
}
