// Inline SVG icon set for link cards and section surfaces.
//
// Why inline SVG: the site ships a strict CSP (`script-src 'self'`,
// `connect-src 'none'`) and bakes every byte at build time. Inline stroke
// icons add visual affordance to link cards with zero external requests, no new
// binary assets, and nothing for the static-security gate to flag — they are
// plain markup (no <script>, no event handlers). Each icon is a 24×24
// Lucide-style stroke glyph that inherits `currentColor`, so theme + accent
// styling lives entirely in CSS (`.card-icon`).
//
// Keep paths simple and self-closing. Add a new key here, then reference it via
// a card's `icon` field (content JSON) or inline card definition.

const ICON_PATHS = {
  // Mission / structure / the Institute itself — a classical landmark.
  institute:
    '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>',
  // Programs — stacked layers / cohorts.
  programs:
    '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  // Projects — a folder of work.
  projects:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  // Learning — an open book.
  learning:
    '<path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5Z"/><path d="M12 6.5v13"/>',
  // Ecosystem — a small network of connected nodes.
  ecosystem:
    '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 7l4 9M17 7l-4 9M6 6h12"/>',
  // Open Source Map — a folded map.
  map:
    '<path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6l6-2Z"/><path d="M9 4v14M15 6v14"/>',
  // Directory / global index — a list.
  directory:
    '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  // Resources — a bookmark.
  resources:
    '<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4Z"/>',
  // People / community.
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 4a3 3 0 0 1 0 6"/><path d="M18 15c2.4.5 4 2.3 4 5"/>',
  // Participate / get involved — a spark.
  participate:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  // Search.
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  // Calendar / events.
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
};

/**
 * Render an inline SVG card icon by name. Returns "" for unknown names so
 * callers can pass an optional `icon` field without guarding.
 *
 * @param {string} name - key in ICON_PATHS
 * @returns {string} inline <svg> markup, or "" when no icon matches
 */
export function cardIcon(name) {
  const path = name && ICON_PATHS[name];
  if (!path) return "";
  return `<svg class="card-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function hasIcon(name) {
  return Boolean(name && ICON_PATHS[name]);
}
