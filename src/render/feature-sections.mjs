import { techTreeExplorerSection, governanceGraphSection, ontologyTermsGraphSection } from "./graphs.mjs";
import { tableSection, ontologyTermsTable } from "./tables.mjs";
import { narrativeSection } from "./narrative.mjs";
import { domainProjectsSection } from "../pages/ecosystem.mjs";
import { EXPORT_PROVENANCE, siteData, loadProjectsData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";
import { sectionHeading } from "./components.mjs";
import { relPrefix } from "./urls.mjs";
import { sourceAnchor } from "./sources.mjs";

// Book-cover feature section: renders a page's `books[]` (cover image + title,
// authors, year, status, and a publisher link resolved via sourceId). Covers are
// local assets (img-src 'self'); the publisher anchor is a vetted live source.
function bookCoversSection(page, currentDir = "") {
  const books = Array.isArray(page.books) ? page.books : [];
  if (!books.length) {
    return "";
  }
  const prefix = relPrefix(currentDir);
  const figures = books
    .map(
      (b) => `
      <figure class="book-cover">
        <img src="${escapeHtml(prefix + b.cover)}" alt="${escapeHtml(b.alt || b.title)}" width="${Number(b.width) || 298}" height="${Number(b.height) || 445}" loading="lazy" decoding="async">
        <figcaption>
          <p class="book-cover-title">${escapeHtml(b.title)}</p>
          <p class="book-cover-meta">${escapeHtml(b.authors)}${b.year ? ` · ${escapeHtml(String(b.year))}` : ""}</p>
          ${b.status ? `<p class="book-cover-status">${escapeHtml(b.status)}</p>` : ""}
          ${b.sourceId ? `<p class="book-cover-link">${sourceAnchor(b.sourceId, "View at MIT Press")}</p>` : ""}
        </figcaption>
      </figure>`,
    )
    .join("");
  return `<section class="content-band book-covers-band" id="textbooks">
    ${sectionHeading({ eyebrow: "Textbooks", title: "The books we read", text: "The Textbook Group works cohort-by-cohort through these Active Inference texts." })}
    <div class="book-covers">${figures}</div>
  </section>`;
}

// ── InstituteOS feature sections (graphs, narratives, domains, related projects) ──

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function manifestFiles() {
  return Array.isArray(EXPORT_PROVENANCE.files) ? EXPORT_PROVENANCE.files : [];
}

function gateMetric({ label, value, text, href }) {
  const body = `<strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><p>${escapeHtml(text)}</p>`;
  if (href) {
    return `<a class="gate-metric" href="${escapeHtml(href)}">${body}</a>`;
  }
  return `<div class="gate-metric">${body}</div>`;
}

export function homeInstituteosGate(currentDir = "") {
  const exportedRecords = manifestFiles().reduce((total, file) => total + Number(file.record_count || 0), 0);
  return `<section class="content-band interface-gate-home" id="public-interface">
    ${sectionHeading({
      eyebrow: "InstituteOS interface",
      title: "Private source, public-safe surface",
      text: "The public site now makes its export boundary visible: private docs and library records inform the site only through authored copy, public sync output, and the strict export gate.",
    })}
    <div class="gate-home-grid">
      ${gateMetric({
        label: "public export artifacts",
        value: formatCount(manifestFiles().length),
        text: `${formatCount(exportedRecords)} records tracked in the public export manifest.`,
        href: hrefForSlug("instituteos", currentDir, "export-snapshot"),
      })}
      ${gateMetric({
        label: "Open Source Map rows",
        value: formatCount(
          (siteData.instituteos.people.records || []).length +
            (siteData.instituteos.projects.records || []).length +
            (siteData.instituteos.ideas.records || []).length +
            (siteData.instituteos.ontology.edges || []).length,
        ),
        text: "Searchable public rows for people, repositories, ideas, and ontology relationships.",
        href: hrefForSlug("knowledge", currentDir),
      })}
      ${gateMetric({
        label: "gate version",
        value: EXPORT_PROVENANCE.gate_version || "tracked",
        text: "The export manifest records the public-safety gate version and source fingerprint.",
        href: hrefForSlug("instituteos", currentDir, "public-export-gate"),
      })}
    </div>
  </section>`;
}

function instituteosInterfaceSection(currentDir = "") {
  const files = manifestFiles();
  const exportedRecords = files.reduce((total, file) => total + Number(file.record_count || 0), 0);
  const generatedAt = EXPORT_PROVENANCE.generated_at
    ? new Date(EXPORT_PROVENANCE.generated_at).toISOString().replace(".000Z", "Z")
    : "Not recorded";
  const artifactRows = files
    .map((file) => `<article class="export-artifact">
      <strong>${escapeHtml(file.name)}</strong>
      <span>${formatCount(file.record_count)} records</span>
      <em>${escapeHtml(file.output_path || "")}</em>
    </article>`)
    .join("");

  return `<section class="content-band interface-gate-section" id="public-export-gate">
    ${sectionHeading({
      eyebrow: "Public export gate",
      title: "The private-to-public boundary is explicit",
      text: "Private InstituteOS sources are projected into public artifacts only after the exporter, privacy gate, website checks, and browser inspection agree that the output is public-safe.",
    })}
    <div class="gate-ladder" aria-label="Private to public export steps">
      <article>
        <span>01</span>
        <h3>Author privately</h3>
        <p>Docs and library registries remain the source of truth for operational and governance work.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Project publicly</h3>
        <p>Exporter modules choose only public fields, public summaries, graph nodes, and approved brand assets.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Gate payloads</h3>
        <p>PublicGate rejects direct private-platform destinations, contact details, private keys, raw tasks, and working artifacts.</p>
      </article>
      <article>
        <span>04</span>
        <h3>Build and verify</h3>
        <p>The website rebuilds clean URLs, search data, feeds, sitemap files, and provenance before release.</p>
      </article>
    </div>
    <div class="export-snapshot" id="export-snapshot">
      <div>
        <p class="eyebrow">Current public snapshot</p>
        <h3>${formatCount(files.length)} artifacts, ${formatCount(exportedRecords)} manifest records</h3>
        <p>Gate version ${escapeHtml(EXPORT_PROVENANCE.gate_version || "not recorded")}; source fingerprint ${escapeHtml(EXPORT_PROVENANCE.source_fingerprint || "not recorded")}; generated ${escapeHtml(generatedAt)}.</p>
        <div class="mini-links">
          <a href="${hrefForSlug("knowledge", currentDir)}">Open Source Map</a>
          <a href="${hrefForSlug("directory", currentDir, "open-source-map")}">Directory rows</a>
          <a href="${hrefForSlug("sitemap", currentDir)}">Sitemap</a>
        </div>
      </div>
      <div class="export-artifacts" aria-label="Export manifest artifacts">
        ${artifactRows}
      </div>
    </div>
  </section>`;
}

// InstituteOS feature blocks injected into a curated public page, keyed by slug.
// Returns markup inserted between the article stack and the key-surfaces band so
// the required curated section ordering stays intact.
function ontologyTermsFeature(currentDir = "") {
  const data = siteData.ontologyTerms;
  const rows = (data.terms || []).map((term) => ({ ...term, rowId: term.id }));
  return (
    ontologyTermsGraphSection(currentDir) +
    tableSection({
      id: "ontology-terms-table",
      eyebrow: "Ontology terms",
      title: `All ${rows.length} Active Inference Ontology terms`,
      text: "The full public ontology (v5): each term with its tag, definition, and a correct example. The graph above shows how the terms connect.",
      countLabel: `${rows.length} terms across ${(data.tags || []).length} tags`,
      tableHtml: ontologyTermsTable(rows),
    })
  );
}

// Activities feature section — replaces the raw-markdown Coda narrative dump with
// two data-driven, scannable blocks: (1) upcoming public activities from the
// calendar snapshot, (2) a searchable list of active Institute/Ecosystem projects
// to get involved with. Both read public-gated InstituteOS exports.
const ACT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatActivityDate(start) {
  const s = String(start || "");
  if (s.length < 10) {
    return s;
  }
  const month = ACT_MONTHS[Number(s.slice(5, 7)) - 1] || "";
  const day = String(Number(s.slice(8, 10)) || "");
  const year = s.slice(0, 4);
  if (s.length <= 10) {
    return `${month} ${day}, ${year}`;
  }
  return `${month} ${day}, ${year} · ${s.slice(11, 16)} UTC`;
}

function activitiesFeatureSection(currentDir = "") {
  // (1) Upcoming activities: calendar events on/after the public export date,
  // sorted ascending and capped. Reference date is the export stamp (data, not
  // Date.now()) so the build stays deterministic.
  const ref = String(EXPORT_PROVENANCE.generated_at || "").slice(0, 10);
  const records = (siteData.instituteos && siteData.instituteos.calendar && siteData.instituteos.calendar.records) || [];
  const upcoming = records
    .filter((e) => e && e.title && (!ref || String(e.start || "").slice(0, 10) >= ref))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .slice(0, 12);
  const calRows = upcoming
    .map(
      (e) => `<tr><td class="activity-when">${escapeHtml(formatActivityDate(e.start))}</td><td>${escapeHtml(e.title)}</td></tr>`,
    )
    .join("");
  const calendarBlock = `<section class="content-band" id="upcoming-activities">
    ${sectionHeading({ eyebrow: "Calendar", title: "Upcoming public activities", text: "Recurring meetings, learning sessions, and streams from the Institute calendar. Browse the full schedule and subscribe on the calendar page." })}
    ${
      calRows
        ? `<div class="table-wrap"><table class="activities-table"><thead><tr><th scope="col">When (UTC)</th><th scope="col">Activity</th></tr></thead><tbody>${calRows}</tbody></table></div>`
        : `<p>See the full calendar for upcoming activities.</p>`
    }
    <p class="section-link"><a href="${hrefForSlug("calendar", currentDir)}">Open the full calendar &amp; subscribe</a></p>
  </section>`;

  // (2) Searchable list of active Institute/Ecosystem projects open to participation.
  const projects = (loadProjectsData().projects || [])
    .filter((p) => p && p.status === "active")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  const projRows = projects
    .map((p) => {
      const title = escapeHtml(p.title || p.id || "");
      const summary = escapeHtml(p.summary || p.description || "");
      const slug = p.website_slug || "";
      const titleCell = slug ? `<a href="${hrefForSlug(slug, currentDir)}">${title}</a>` : title;
      const search = escapeHtml(`${p.title || ""} ${p.summary || ""} ${p.description || ""} ${(p.topics || []).join(" ")}`.toLowerCase());
      return `<tr data-activity-row data-search="${search}"><td>${titleCell}</td><td>${summary}</td></tr>`;
    })
    .join("");
  const projectsBlock = `<section class="content-band" id="active-projects">
    ${sectionHeading({ eyebrow: "Get involved", title: "Active projects", text: "Active Institute and Ecosystem projects open to participation. Search to find one that fits, then open its page to see how to join." })}
    <div class="activities-search">
      <input id="activities-project-search" type="search" placeholder="Search ${projects.length} active projects by name or topic…" autocomplete="off" aria-label="Search active projects">
      <span id="activities-project-count" aria-live="polite"></span>
    </div>
    <div class="table-wrap"><table class="activities-table"><thead><tr><th scope="col">Project</th><th scope="col">About</th></tr></thead><tbody>${projRows}</tbody></table></div>
    <p class="section-link"><a href="${hrefForSlug("projects", currentDir)}">Browse all projects</a></p>
  </section>`;

  return calendarBlock + projectsBlock;
}

export function instituteosFeatureSections(page, currentDir = "") {
  switch (page.slug) {
    case "instituteos":
      return instituteosInterfaceSection(currentDir);
    case "project-textbook-group":
      return bookCoversSection(page, currentDir);
    case "project-active-inference-ontology":
      return ontologyTermsFeature(currentDir);
    case "learning":
      return techTreeExplorerSection(currentDir);
    case "structure":
      return (
        governanceGraphSection(currentDir) +
        narrativeSection({
          id: "structure-narratives",
          eyebrow: "Institute structure",
          title: "How the Institute is organized",
          text: "Public narrative content describing how the Institute is structured and organized.",
          targetPage: "structure",
        })
      );
    case "ecosystem":
      return (
        domainProjectsSection(currentDir) +
        narrativeSection({
          id: "ecosystem-narratives",
          eyebrow: "Ecosystem",
          title: "The Active Inference ecosystem",
          text: "Public narrative content describing the ecosystem and its domains of application.",
          targetPage: "ecosystem",
        })
      );
    case "about":
      return narrativeSection({
        id: "about-narratives",
        eyebrow: "Institute narrative",
        title: "Mission, history, and direction",
        text: "Public mission, vision, values, history, strategy, and focus-area prose for the Institute.",
        targetPage: "about",
      });
    case "activities":
      return activitiesFeatureSection(currentDir);
    case "activities-disabled-narrative":
      return narrativeSection({
        id: "activities-narratives",
        eyebrow: "Activities",
        title: "Public activities and updates",
        text: "Public narrative content describing the Institute's recurring activities.",
        targetPage: "activities",
      });
    default:
      return "";
  }
}
