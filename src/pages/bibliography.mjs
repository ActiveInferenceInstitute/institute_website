import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../lib/text.mjs";
import { sectionHeading } from "../render/components.mjs";

const _dir = path.dirname(fileURLToPath(import.meta.url));
const bibPath = path.join(_dir, "..", "content", "bibliography.json");

/**
 * Render the full bibliography page content — injected via feature-sections.mjs.
 */
export function renderBibliographyList() {
  if (!fs.existsSync(bibPath)) {
    return `<section class="content-band" id="citations">
      ${sectionHeading({ eyebrow: "Bibliography", title: "Data not yet generated", text: "Run scripts/generate_bibliography.py." })}
    </section>`;
  }

  const bib = JSON.parse(fs.readFileSync(bibPath, "utf8"));

  return `
  ${renderFieldOverview(bib)}
  ${renderCorpusAssessment(bib)}
  ${renderHypotheses(bib)}
  ${renderSubfields(bib)}
  ${renderTopics(bib)}
  ${renderCitationNetwork(bib)}
  ${renderReferenceList(bib)}
  ${renderQuality(bib)}`;
}

function renderFieldOverview(bib) {
  const fo = bib.field_overview || {};
  if (!fo.total_papers) return "";
  const years = fo.year_counts || {};
  const yearsSorted = Object.keys(years).sort();
  const maxCount = Math.max(...Object.values(years), 1);

  // Mini bar chart using CSS width
  const bars = yearsSorted
    .map((y) => {
      const count = years[y] || 0;
      const pct = Math.round((count / maxCount) * 100);
      return `<div class="topic-bar-row">
        <span class="topic-bar-label">${escapeHtml(y)}</span>
        <span class="topic-bar"><span class="topic-bar-fill" style="width:${pct}%"></span></span>
        <span class="topic-bar-value">${count}</span>
      </div>`;
    })
    .join("");

  return `<section class="content-band" id="field-overview">
    ${sectionHeading({
      eyebrow: "Field overview",
      title: `Active Inference literature: ${fo.total_papers} papers (${fo.first_year}–${fo.last_year})`,
      text: "The corpus spans two decades of Active Inference and Free Energy Principle research, retrieved from arXiv, Semantic Scholar, and OpenAlex.",
    })}
    <div class="resource-grid compact-grid">
      <article class="info-card">
        <h3>Growth metrics</h3>
        <p><strong>Total papers:</strong> ${fo.total_papers}</p>
        <p><strong>CAGR:</strong> ${fo.cagr}%</p>
        <p><strong>Doubling time:</strong> ${fo.doubling_time_years} years</p>
        <p><strong>Peak year:</strong> ${fo.peak_year} (${fo.peak_count} papers)</p>
        <p><strong>Cumulative (2026):</strong> ${fo.cumulative_2026}</p>
      </article>
      <article class="info-card">
        <h3>Papers per year</h3>
        <div class="bar-chart">${bars}</div>
      </article>
    </div>
  </section>`;
}

function renderCorpusAssessment(bib) {
  const ca = bib.corpus_assessment || {};
  if (!ca.total_papers) return "";
  const sources = ca.fulltext_sources || {};

  return `<section class="content-band muted" id="corpus-assessment">
    ${sectionHeading({
      eyebrow: "Corpus assessment",
      title: `${ca.total_papers} papers indexed and assessed`,
      text: "Coverage and availability statistics for the full literature corpus.",
    })}
    <div class="resource-grid compact-grid">
      <article class="info-card">
        <h3>Coverage</h3>
        <p><strong>Abstracts:</strong> ${ca.abstract_coverage_pct}%</p>
        <p><strong>Open access:</strong> ${ca.open_access_pct}%</p>
        <p><strong>Full-text PDF:</strong> ${ca.pdf_availability_pct}%</p>
      </article>
      <article class="info-card">
        <h3>Full-text sources</h3>
        ${Object.entries(sources)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([src, count]) => `<p><strong>${escapeHtml(src)}:</strong> ${count}</p>`)
          .join("")}
      </article>
      <article class="info-card">
        <h3>Identifier coverage</h3>
        ${Object.entries(ca.identifier_coverage || {})
          .map(([id, count]) => `<p><strong>${escapeHtml(id)}:</strong> ${count}</p>`)
          .join("")}
      </article>
    </div>
  </section>`;
}

function renderHypotheses(bib) {
  const hypotheses = bib.hypotheses || [];
  if (!hypotheses.length) return "";

  const cards = hypotheses
    .map((h) => {
      const barPct = Math.round(h.pct);
      return `<article class="info-card">
        <h3>${escapeHtml(h.name)}</h3>
        <div class="score-bar-row">
          <span class="score-bar-label">Evidence score</span>
          <span class="score-bar"><span class="score-bar-fill" style="width:${barPct}%"></span></span>
          <span class="score-bar-value">${barPct}%</span>
        </div>
        <p class="score-detail">
          ${h.supports ? `${h.supports} supporting` : ""}${h.supports && h.neutral ? ", " : ""}${h.neutral ? `${h.neutral} neutral` : ""}${(h.supports || h.neutral) && h.contradicts ? ", " : ""}${h.contradicts ? `${h.contradicts} contradicting` : ""} assertions
        </p>
      </article>`;
    })
    .join("");

  return `<section class="content-band" id="hypotheses">
    ${sectionHeading({
      eyebrow: "Hypothesis evidence",
      title: "8 core hypotheses evaluated across the literature",
      text: "Each hypothesis was scored using citation-weighted evidence from LLM-extracted assertions (Nanopublications). Scores reflect the aggregate evidential support found in the corpus.",
    })}
    <div class="card-grid">${cards}</div>
    ${bib.assertion_summary ? `<p class="category-count">${bib.assertion_summary.total_assertions} total assertions extracted from paper abstracts</p>` : ""}
  </section>`;
}

function renderSubfields(bib) {
  const subfields = bib.subfields || [];
  if (!subfields.length) return "";

  const maxCount = Math.max(...subfields.map((s) => s.count), 1);
  const rows = subfields
    .map((s) => {
      const pct = Math.round((s.count / maxCount) * 100);
      return `<div class="topic-bar-row">
        <span class="topic-bar-label">${escapeHtml(s.name)}</span>
        <span class="topic-bar"><span class="topic-bar-fill" style="width:${pct}%"></span></span>
        <span class="topic-bar-value">${s.count}</span>
      </div>`;
    })
    .join("");

  return `<section class="content-band muted" id="subfields">
    ${sectionHeading({
      eyebrow: "Subfield distribution",
      title: `${subfields.length} domains classified across the corpus`,
      text: "Papers were classified into 8 subfield categories using keyword-based rules applied to titles and abstracts.",
    })}
    <div class="bar-chart">${rows}</div>
    <p class="category-count">Total classified assignments: ${subfields.reduce((sum, s) => sum + s.count, 0)}</p>
  </section>`;
}

function renderTopics(bib) {
  const topics = bib.topics || [];
  if (!topics.length) return "";

  const cards = topics
    .map((t) => {
      const words = (t.top_words || [])
        .map((w, i) => `${escapeHtml(w)} (${(t.top_weights || [])[i] || ""})`)
        .join(", ");
      return `<article class="info-card">
        <h3>Topic ${t.id + 1}</h3>
        <p>${words}</p>
      </article>`;
    })
    .join("");

  return `<section class="content-band" id="topics">
    ${sectionHeading({
      eyebrow: "Topic landscape",
      title: `${topics.length} topics extracted via NMF`,
      text: "Non-negative Matrix Factorization (NMF) was applied to TF-IDF vectors of paper titles and abstracts, revealing five thematic clusters in the literature.",
    })}
    <div class="card-grid">${cards}</div>
  </section>`;
}

function renderCitationNetwork(bib) {
  const cn = bib.citation_network || {};
  if (!cn.num_nodes) return "";

  const topPapers = (cn.top_pagerank_dois || [])
    .slice(0, 5)
    .map((p) => `<li><a href="https://doi.org/${escapeHtml(p.doi)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.doi)}</a> <span class="bib-extra">(${p.score})</span></li>`)
    .join("");

  return `<section class="content-band muted" id="citation-network">
    ${sectionHeading({
      eyebrow: "Citation network",
      title: `${cn.num_nodes} nodes, ${cn.num_edges} edges, ${cn.total_references} references`,
      text: "The citation graph was constructed from paper reference lists. PageRank, hub, and authority scores identify the most influential papers in the network.",
    })}
    <div class="resource-grid compact-grid">
      <article class="info-card">
        <h3>Network metrics</h3>
        <p><strong>Nodes:</strong> ${cn.num_nodes}</p>
        <p><strong>Edges:</strong> ${cn.num_edges}</p>
        <p><strong>Density:</strong> ${cn.density}</p>
        <p><strong>Avg degree:</strong> ${cn.avg_degree}</p>
      </article>
      <article class="info-card">
        <h3>Top papers by PageRank</h3>
        <ul class="bib-list">${topPapers}</ul>
      </article>
    </div>
  </section>`;
}

function renderReferenceList(bib) {
  const sections = bib.bibliography || [];
  if (!sections.length) return "";

  let html = "";
  for (const section of sections) {
    if (!section.entries || !section.entries.length) continue;
    html += `
    <div class="bib-section">
      <h3>${escapeHtml(section.title)}</h3>
      <ul class="bib-list">
        ${section.entries
          .map((entry) => {
            const url = entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : "");
            const titleLink = url
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title || "Untitled")}</a>`
              : escapeHtml(entry.title || "Untitled");
            const meta = [entry.authors ? escapeHtml(entry.authors) : "", entry.year ? `(${escapeHtml(entry.year)})` : ""]
              .filter(Boolean).join(" ");
            const venue = [entry.journal ? `<em>${escapeHtml(entry.journal)}</em>` : "", entry.volume ? escapeHtml(entry.volume) : "",
              entry.number ? `(${escapeHtml(entry.number)})` : "", entry.pages ? escapeHtml(entry.pages) : ""]
              .filter(Boolean).join(", ");
            const extra = [entry.publisher ? escapeHtml(entry.publisher) : "", entry.doi ? `DOI: ${escapeHtml(entry.doi)}` : ""]
              .filter(Boolean).join(" · ");
            return `<li class="bib-entry">
              <span class="bib-title">${titleLink}</span>
              <span class="bib-meta">${meta}</span>
              ${venue ? `<span class="bib-venue">${venue}.</span>` : ""}
              ${extra ? `<span class="bib-extra">${extra}</span>` : ""}
            </li>`;
          })
          .join("\n        ")}
      </ul>
    </div>`;
  }

  return `<section class="content-band" id="citations">
    ${sectionHeading({
      eyebrow: "Full bibliography",
      title: `${bib.total_references} curated references in ${sections.length} sections`,
      text: "Every reference is linked to its DOI or source URL. The BibTeX source is available on GitHub.",
    })}
    ${html}
  </section>`;
}

function renderQuality(bib) {
  const q = bib.quality || {};
  if (!q.tests_total) return "";

  return `<section class="content-band muted" id="quality">
    ${sectionHeading({
      eyebrow: "Project quality",
      title: "Reproducibility and validation",
      text: "The meta-analysis pipeline is fully tested and validated. All gates pass before any output is published.",
    })}
    <div class="resource-grid compact-grid">
      <article class="info-card">
        <h3>Test suite</h3>
        <p><strong>Tests passed:</strong> ${q.tests_passed} / ${q.tests_total}</p>
        <p><strong>Coverage:</strong> ${q.coverage_pct}%</p>
        <p><strong>Pipeline stages:</strong> ${q.pipeline_stages}</p>
      </article>
      <article class="info-card">
        <h3>Validation</h3>
        <p><strong>All checks passed:</strong> ${q.all_validation_passed ? "Yes" : "No"}</p>
        <p><strong>Total checks:</strong> ${q.total_checks}</p>
        <p><strong>Pipeline duration:</strong> ${escapeHtml(String(q.pipeline_duration || "N/A"))}</p>
      </article>
      <article class="info-card">
        <h3>Project links</h3>
        <p><a href="${escapeHtml(bib.github_url)}" target="_blank" rel="noopener noreferrer">Repository ↗</a></p>
        <p><a href="${escapeHtml(bib.github_url)}/blob/main/manuscript/references.bib" target="_blank" rel="noopener noreferrer">BibTeX source ↗</a></p>
        <p><a href="${escapeHtml(bib.github_url)}/blob/main/output/pdf/act_inf_metaanalysis_combined.pdf" target="_blank" rel="noopener noreferrer">Full manuscript ↗</a></p>
      </article>
    </div>
  </section>`;
}
