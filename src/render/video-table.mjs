import { escapeHtml } from "../lib/text.mjs";
import { tableRows } from "./tables.mjs";
import { sectionHeading } from "./components.mjs";
import { listText } from "./text.mjs";

// /video/ page: full searchable table of the Institute's public video/podcast
// library (backed by InstituteOS's videos.json export). The Video column links
// out directly to YouTube — every youtubeUrl in the export resolves to a
// youtube.com/youtu.be host, which the site's external-anchor gate
// (VETTED_ANCHOR_HOST_SUFFIXES in check_site_contract.py / check_static_security.py)
// accepts without a per-URL live-sources.json entry, same treatment as the
// per-event YouTube/Zoom links on /calendar/ (see pages/calendar.mjs eventCard).
// isYoutubeHost() re-checks the host defensively at render time so a future
// non-YouTube URL falls back to plain text instead of silently failing the gate.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YOUTUBE_HOST_SUFFIXES = ["youtube.com", "youtu.be"];

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

function sortKeyText(value) {
  return String(value || "").toLowerCase().trim();
}

function isYoutubeHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return YOUTUBE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function videoLinkCell(url) {
  if (!url) {
    return "";
  }
  return isYoutubeHost(url)
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">▶ Watch ↗</a>`
    : `<span class="event-url">${escapeHtml(url)}</span>`;
}

function videoColumns() {
  return [
    { label: "Date", sortKey: "date", render: (v) => escapeHtml(formatVideoDate(v.date)) },
    { label: "Series", sortKey: "series", render: (v) => escapeHtml([v.series, v.number].filter(Boolean).join(" ")) },
    { label: "Title", sortKey: "title", render: (v) => escapeHtml(v.title || "Untitled") },
    { label: "Guests", sortKey: "guests", render: (v) => escapeHtml(listText((v.guests || []).map((g) => g.name), "")) },
    { label: "Video", render: (v) => videoLinkCell(v.youtubeUrl) },
  ];
}

// Local head builder (not tables.mjs's shared tableHead): sortable columns are
// a video-table-only feature, so this stays out of the 10-table-shared helper.
function videoTableHead(columns) {
  return columns
    .map((column) => {
      if (!column.sortKey) {
        return `<th>${escapeHtml(column.label)}</th>`;
      }
      return `<th aria-sort="none"><button type="button" class="th-sort" data-sort-key="${escapeHtml(column.sortKey)}">${escapeHtml(column.label)}<span class="sort-icon" aria-hidden="true"></span></button></th>`;
    })
    .join("");
}

function videoDataTable({ caption, columns, rows, className }) {
  return `<div class="table-wrap"><table class="${className}">
    <caption>${escapeHtml(caption)}</caption>
    <thead><tr>${videoTableHead(columns)}</tr></thead>
    <tbody>${tableRows(rows, columns)}</tbody>
  </table></div>`;
}

// Distinct format tags across the dataset, for the Type filter dropdown. Only
// ~7 values exist (Context, Solo, Dyad, Group, Paper, Presentation, Roundtable;
// see instituteos.core.models.video.VideoEntry.types), so a plain <select> is
// the whole affordance — no need for a multi-tag chip picker.
function distinctTypes(videos) {
  const set = new Set();
  for (const video of videos) {
    for (const type of video.types || []) {
      if (type) {
        set.add(type);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function videoTableSection(videos, currentDir = "") {
  const rows = videos.map((v) => {
    const seriesLabel = [v.series, v.number].filter(Boolean).join(" ");
    const guestNames = (v.guests || []).map((g) => g.name).filter(Boolean);
    const types = (v.types || []).filter(Boolean);
    const dataAttrs =
      ` data-types="${escapeHtml(types.join("|"))}"` +
      ` data-sort-date="${escapeHtml(v.date || "")}"` +
      ` data-sort-series="${escapeHtml(sortKeyText(seriesLabel))}"` +
      ` data-sort-title="${escapeHtml(sortKeyText(v.title))}"` +
      ` data-sort-guests="${escapeHtml(sortKeyText(guestNames.join(", ")))}"`;
    return { ...v, rowId: v.id, dataAttrs };
  });
  const typeOptions = distinctTypes(videos)
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
    .join("");
  const filterBar = `
    <div class="table-filter" role="search">
      <div class="table-filter-field">
        <label class="table-filter-label" for="video-table-filter">Filter videos</label>
        <input type="search" id="video-table-filter" class="table-filter-input" placeholder="Filter by title, series, guest, date…" autocomplete="off" spellcheck="false">
      </div>
      <div class="table-filter-field">
        <label class="table-filter-label" for="video-table-type">Type</label>
        <select id="video-table-type" class="table-filter-select">
          <option value="">All types</option>
          ${typeOptions}
        </select>
      </div>
      <p id="video-table-filter-status" class="table-filter-status" role="status" aria-live="polite">${rows.length} videos</p>
    </div>`;
  return `<section class="content-band" id="video-library">
    ${sectionHeading({
      eyebrow: "Video & podcast library",
      title: `All ${rows.length} recorded sessions`,
      text: "Every recorded livestream, learning-group session, interview, and presentation the Institute has published, in one searchable, sortable table. Select ▶ Watch to open a session on YouTube.",
    })}
    <div id="video-table-mount">
      ${filterBar}
      ${videoDataTable({ caption: "Active Inference Institute video and podcast library.", columns: videoColumns(), rows, className: "directory-table video-table" })}
    </div>
  </section>`;
}
