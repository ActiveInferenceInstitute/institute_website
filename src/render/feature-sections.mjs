import { techTreeExplorerSection, governanceGraphSection } from "./graphs.mjs";
import { narrativeSection } from "./narrative.mjs";
import { domainProjectsSection } from "../pages/ecosystem.mjs";
import { EXPORT_PROVENANCE, siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";
import { sectionHeading } from "./components.mjs";

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
export function instituteosFeatureSections(page, currentDir = "") {
  switch (page.slug) {
    case "instituteos":
      return instituteosInterfaceSection(currentDir);
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
