import { escapeHtml } from "../lib/text.mjs";
import { dataTable } from "./tables.mjs";
import { sectionHeading } from "./components.mjs";
import { listText } from "./text.mjs";

// /video/ page: full searchable table of the Institute's public video/podcast
// library (backed by InstituteOS's videos.json export). External video/paper/
// DOI links are rendered as plain selectable text, NOT <a href> anchors — the
// site's external-anchor gate (live-sources.json) is a curated per-URL
// allowlist, and this table carries ~700 distinct per-row URLs that can't
// scale through it. Same treatment as /calendar/'s event URLs (see
// pages/calendar.mjs eventCard: "the URL itself is shown as selectable text,
// not a clickable external anchor").

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deterministic ISO-date formatter (no Date()/locale — matches calendar.mjs's
// formatEventDate convention). Video dates are date-only ("YYYY-MM-DD").
function formatVideoDate(iso) {
  const s = String(iso || "");
  if (s.length < 10) {
    return s || "Undated";
  }
  const month = MONTHS[Number(s.slice(5, 7)) - 1] || "";
  const day = String(Number(s.slice(8, 10)) || "");
  const year = s.slice(0, 4);
  return `${month} ${day}, ${year}`;
}

function videoColumns() {
  return [
    { label: "Date", render: (v) => escapeHtml(formatVideoDate(v.date)) },
    { label: "Series", render: (v) => escapeHtml([v.series, v.number].filter(Boolean).join(" ")) },
    { label: "Title", render: (v) => escapeHtml(v.title || "Untitled") },
    { label: "Type", render: (v) => escapeHtml(listText(v.types, "")) },
    { label: "Keywords", render: (v) => escapeHtml(listText(v.keywords, "")) },
    { label: "Ontology terms", render: (v) => escapeHtml(listText(v.ontologyTerms, "")) },
    { label: "Guests", render: (v) => escapeHtml(listText((v.guests || []).map((g) => g.name), "")) },
    { label: "Video", render: (v) => (v.youtubeUrl ? `<span class="event-url">${escapeHtml(v.youtubeUrl)}</span>` : "") },
  ];
}

export function videoTableSection(videos, currentDir = "") {
  const rows = videos.map((v) => ({ ...v, rowId: v.id }));
  const filterBar = `
    <div class="table-filter" role="search">
      <label class="table-filter-label" for="video-table-filter">Filter videos</label>
      <input type="search" id="video-table-filter" class="table-filter-input" placeholder="Filter by title, series, guest, keyword, date…" autocomplete="off" spellcheck="false">
      <p id="video-table-filter-status" class="table-filter-status" role="status" aria-live="polite">${rows.length} videos</p>
    </div>`;
  return `<section class="content-band" id="video-library">
    ${sectionHeading({
      eyebrow: "Video & podcast library",
      title: `All ${rows.length} recorded sessions`,
      text: "Every recorded livestream, learning-group session, interview, and presentation the Institute has published, in one searchable table. Video links are shown as plain text for you to open on YouTube directly — this table does not link out automatically.",
    })}
    <div id="video-table-mount">
      ${filterBar}
      ${dataTable({ caption: "Active Inference Institute video and podcast library.", columns: videoColumns(), rows, className: "directory-table video-table" })}
    </div>
  </section>`;
}
