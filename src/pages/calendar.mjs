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

function eventCard(event, currentDir) {
  const title = escapeHtml(event.title || "Untitled event");
  const when = escapeHtml(formatEventDate(event));
  const status = String(event.status || "").toUpperCase();
  const cancelled = status === "CANCELLED";
  const statusTag = cancelled ? '<span class="event-status cancelled">Cancelled</span>' : "";
  // The site CSP/security contract requires every external anchor to be vetted in
  // live-sources.json. Per-event video/meeting URLs are unvetted public links, so
  // they are rendered as selectable text (with the URL in title=) rather than as
  // clickable external anchors — CSP-safe and contract-clean. The whole calendar
  // is reachable via the two registered Subscribe links at the top of the page.
  const link = event.url
    ? `<p class="event-link" title="${escapeHtml(event.url)}">▶ ${escapeHtml(linkLabel(event.url))}: <span class="event-url">${escapeHtml(event.url)}</span></p>`
    : "";
  return `<li class="event-row${cancelled ? " is-cancelled" : ""}">
    <div class="event-when"><time datetime="${escapeHtml(String(event.start || ""))}">${when}</time>${statusTag}</div>
    <div class="event-body"><h3>${title}</h3>${link}</div>
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

  const upcomingList = upcoming.length
    ? `<ul class="event-list">${upcoming.map((event) => eventCard(event, currentDir)).join("")}</ul>`
    : `<p>No upcoming events are currently published. Subscribe above to be notified when new events are added.</p>`;

  const pastSection = past.length
    ? `<section class="content-band">
        <details class="past-events">
          <summary>Past events (${past.length})</summary>
          <ul class="event-list">${past.map((event) => eventCard(event, currentDir)).join("")}</ul>
        </details>
      </section>`
    : "";

  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Calendar</span></nav>
    <p class="eyebrow">Public events</p>
    <h1>Calendar</h1>
    <p>Livestreams, roundtables, model streams, and open hours from the public <strong>${calName}</strong> calendar. Times are shown as published (UTC unless a timezone is noted).</p>
    ${subscribe.length ? `<div class="hero-actions">${subscribe.join("")}</div>` : ""}
  </section>
  <section class="content-band">
    ${sectionHeading({ eyebrow: "Schedule", title: `Upcoming events (${upcoming.length})`, text: "Pulled from the Institute's public Google Calendar and rendered statically — no tracking, no third-party embeds." })}
    ${upcomingList}
  </section>
  ${pastSection}`;

  return layout({
    title: "Calendar",
    description: "Upcoming Active Inference Institute livestreams, roundtables, and open events from the public Institute calendar.",
    currentDir,
    body,
    slug: "calendar",
  });
}
