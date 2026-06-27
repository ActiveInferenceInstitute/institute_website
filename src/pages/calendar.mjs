import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { siteData, EXPORTED_AT } from "../data.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";

// Public events calendar (/calendar/). Server-baked from the InstituteOS public
// calendar export (src/content/instituteos/calendar.json), which is in turn
// pulled from the public Google Calendar iCal feed by InstituteOS. The site CSP
// forbids iframes and client-side fetches, so every event is rendered into static
// HTML at build time; the only external links are the registered subscribe URLs.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format an ISO start string deterministically (no Date()/locale, timezone-stable).
// Timed events arrive as "YYYY-MM-DDTHH:MM:SS[+00:00]"; all-day as "YYYY-MM-DD".
function formatEventDate(event) {
  const start = String(event.start || "");
  const y = start.slice(0, 4);
  const m = MONTHS[Number(start.slice(5, 7)) - 1] || "";
  const d = String(Number(start.slice(8, 10)) || "");
  if (event.allDay || start.length <= 10) {
    return `${m} ${d}, ${y} · all day`;
  }
  const time = start.slice(11, 16);
  const tz = event.timeZone ? ` ${event.timeZone}` : "";
  return `${m} ${d}, ${y} · ${time}${tz}`;
}

// Short, human label for a known event URL host (the URL itself is shown as
// selectable text, not a clickable external anchor — see eventCard).
function linkLabel(url) {
  const host = url.includes("//") ? url.split("/", 3)[2].toLowerCase() : "";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube livestream";
  if (host.endsWith("zoom.us")) return "Zoom";
  if (host === "meet.google.com") return "Google Meet";
  if (host.endsWith("twitch.tv")) return "Twitch";
  if (host.endsWith("activeinference.institute")) return "Institute page";
  return host || "Link";
}

// Escape iCal text per RFC 5545 (backslash, semicolon, comma, newline).
function icalText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Format a sanitized ISO start/end to an iCal stamp. All-day → YYYYMMDD (DATE);
// timed → YYYYMMDDTHHMMSS, with a trailing Z only when the source is UTC. No
// Date()/locale, timezone-stable to match formatEventDate.
function icalStamp(iso, allDay) {
  const s = String(iso || "");
  const date = s.slice(0, 10).replace(/-/g, "");
  if (!/^\d{8}$/.test(date)) return allDay ? "19700101" : "19700101T000000Z";
  if (allDay || s.length <= 10) return date;
  const time = s.slice(11, 19).replace(/:/g, "");
  if (!/^\d{6}$/.test(time)) return `${date}T000000`;
  const utc = s.endsWith("Z") || s.includes("+00:00");
  return `${date}T${time}${utc ? "Z" : ""}`;
}

function safeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function eventUid(event) {
  const id = safeToken(event.id) || safeToken(`${event.start || ""}-${event.title || ""}`) || "event";
  return `${id}@activeinference.institute`;
}

function eventIcsFilename(event) {
  const date = safeToken(String(event.start || "").slice(0, 10).replace(/-/g, "")) || "event";
  const title = safeToken(event.title).slice(0, 48) || "active-inference-event";
  return `${date}-${title}.ics`;
}

// Build a minimal, public-safe VEVENT from SANITIZED fields only: title, start,
// optional end, all-day flag, and the already-hashed event id as UID. Never emits
// DESCRIPTION, the raw calendar UID, or any event URL (allowlisted or not) — so a
// downloaded .ics can carry no private free-text or unvetted link.
export function buildEventIcs(event) {
  const allDay = Boolean(event.allDay) || String(event.start || "").length <= 10;
  const uid = eventUid(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Active Inference Institute//Public Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icalStamp(EXPORTED_AT, false)}`,
    `${allDay ? "DTSTART;VALUE=DATE:" : "DTSTART:"}${icalStamp(event.start, allDay)}`,
  ];
  if (event.end) {
    lines.push(`${allDay ? "DTEND;VALUE=DATE:" : "DTEND:"}${icalStamp(event.end, allDay)}`);
  }
  lines.push(`SUMMARY:${icalText(event.title || "Untitled event")}`, "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

// Same-origin data: URI download — CSP-safe (the static-security gate skips
// non-http(s) anchor schemes), so no external host and no build-time file needed.
function icsDownloadLink(event) {
  const uri = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildEventIcs(event))}`;
  return `<p class="event-ics"><a href="${uri}" download="${escapeHtml(eventIcsFilename(event))}">📅 Add to calendar (.ics)</a></p>`;
}

function eventCard(event, kind) {
  const title = escapeHtml(event.title || "Untitled event");
  const when = escapeHtml(formatEventDate(event));
  const status = String(event.status || "").toUpperCase();
  const cancelled = status === "CANCELLED";
  const statusTag = cancelled ? '<span class="event-status cancelled">Cancelled</span>' : "";
  // Per-event links are clickable anchors. The sync gate restricts event URLs to
  // a public-host allowlist (YouTube/Zoom/Meet/Institute/…), and the static-security
  // checker accepts those vetted hosts as external-anchor backing — so these pass
  // the contract without a per-URL live-sources entry. target/rel are mandatory.
  const link = event.url
    ? `<p class="event-link"><a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">▶ ${escapeHtml(linkLabel(event.url))} ↗</a></p>`
    : "";
  // data-calendar-search powers the on-page filter (site.js); data-calendar-kind
  // ("upcoming"/"past") drives the kind selector. Search blob is pre-lowercased.
  const blob = `${event.title || ""} ${formatEventDate(event)} ${event.status || ""} ${linkLabel(event.url || "")}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `<li class="event-row${cancelled ? " is-cancelled" : ""}" data-calendar-row data-calendar-kind="${kind}" data-calendar-search="${escapeHtml(blob)}">
    <div class="event-when"><time datetime="${escapeHtml(String(event.start || ""))}">${when}</time>${statusTag}</div>
    <div class="event-body"><h3>${title}</h3>${link}${cancelled ? "" : icsDownloadLink(event)}</div>
  </li>`;
}

export function calendarPage() {
  const currentDir = urlDirForSlug("calendar");
  const calendar = siteData.instituteos.calendar || { records: [], calendarName: "", icsUrl: "", embedUrl: "" };
  const events = (calendar.records || []).filter((event) => event.start);
  // ISO date strings sort and compare lexically; use the stable export date as
  // "now" so the build stays byte-stable (the site never reads a live clock).
  const reference = (EXPORTED_AT || "").slice(0, 10) || "0000-00-00";
  const upcoming = events.filter((event) => String(event.start).slice(0, 10) >= reference);
  const past = events.filter((event) => String(event.start).slice(0, 10) < reference).reverse();
  const calName = escapeHtml(calendar.calendarName || "Active Inference Institute");

  const subscribe = [];
  if (calendar.icsUrl) {
    subscribe.push(
      `<a class="button primary" href="${escapeHtml(calendar.icsUrl)}" target="_blank" rel="noopener noreferrer">Subscribe (iCal) ↗</a>`,
    );
  }
  if (calendar.embedUrl) {
    subscribe.push(
      `<a class="button" href="${escapeHtml(calendar.embedUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Calendar ↗</a>`,
    );
  }

  // One chronological list: upcoming first (ascending), then past (most recent
  // first). Each row is tagged upcoming/past so the on-page filter can scope by
  // kind; the search box (site.js) matches across every row regardless of kind.
  const rowsHtml = [
    ...upcoming.map((event) => eventCard(event, "upcoming")),
    ...past.map((event) => eventCard(event, "past")),
  ].join("");
  const list = events.length
    ? `<ul class="event-list" id="calendar-list">${rowsHtml}</ul>`
    : `<p>No events are currently published. Subscribe above to be notified when new events are added.</p>`;

  const filterBar = events.length
    ? `<div class="calendar-tools" aria-label="Event filters">
        <label>
          <span>Search events</span>
          <input id="calendar-search" type="search" placeholder="Search by title, date, or topic" autocomplete="off" spellcheck="false">
        </label>
        <label>
          <span>Show</span>
          <select id="calendar-kind">
            <option value="upcoming">Upcoming (${upcoming.length})</option>
            <option value="past">Past (${past.length})</option>
            <option value="all">All events (${events.length})</option>
          </select>
        </label>
        <p id="calendar-count" class="result-count" aria-live="polite">${upcoming.length} ${upcoming.length === 1 ? "event" : "events"} shown</p>
      </div>`
    : "";

  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Calendar</span></nav>
    <p class="eyebrow">Public events</p>
    <h1>Calendar</h1>
    <p>Livestreams, roundtables, model streams, and open hours from the public <strong>${calName}</strong> calendar. Times are shown as published (UTC unless a timezone is noted). Use the read-aloud button to listen, or subscribe to get updates.</p>
    ${subscribe.length ? `<div class="hero-actions">${subscribe.join("")}</div>` : ""}
  </section>
  <section class="content-band">
    ${sectionHeading({ eyebrow: "Schedule", title: "Find an event", text: "Pulled from the Institute's public Google Calendar and rendered statically — no tracking, no third-party embeds. Type to search across all events." })}
    ${filterBar}
    ${list}
  </section>`;

  return layout({
    title: "Calendar",
    description: "Upcoming Active Inference Institute livestreams, roundtables, and open events from the public Institute calendar.",
    currentDir,
    body,
    slug: "calendar",
  });
}
