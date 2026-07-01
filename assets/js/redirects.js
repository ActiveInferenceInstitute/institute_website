/*
 * Legacy-URL redirect map for the Active Inference Institute apex domain.
 *
 * GitHub Pages has no server-side redirects, so this file is loaded ONLY by the
 * site 404 page (404.html). GitHub Pages serves 404.html for any path that does
 * not resolve to a built file, so every unmatched request runs this script. If
 * the requested path matches a legacy Squarespace URL below, we replace() to the
 * new clean-URL location; otherwise the normal, informative 404 page is shown.
 *
 * CSP-safe: external 'self' script, no network calls — the map is inline and we
 * only call location.replace().
 *
 * The destination values are paths RELATIVE to the site base (no leading slash,
 * trailing slash to land on the clean directory URL). The script prepends the
 * base it was given via data-base (e.g. "/" on the apex domain, or
 * "/institute_website/" on the GitHub project page) so it works in both.
 *
 * Subdomain shortlinks (fellows.*, structure.*, …) are DNS-level forwards and
 * are NOT handled here — see docs/MIGRATION_REDIRECTS.md for where to repoint
 * each one.
 */
(function () {
  "use strict";

  // Legacy Squarespace apex paths -> new clean-URL destinations.
  // Keys are normalized: lowercase, no leading/trailing slash, no .html suffix.
  var MAP = {
    // Home / orientation
    "home": "",
    "welcome": "get-involved/",

    // Institute / governance
    "about-us": "about/",
    "board-of-directors": "structure/",
    "bod": "structure/",
    "officers": "structure/",
    "scientific-advisory-board": "structure/",
    "sab": "structure/",
    "structure": "structure/",

    // Learn / research
    "courses": "learning/",
    "education": "learning/",
    "research-overview": "learning/",
    "research": "learning/",
    "livestreams": "activities/",
    "physics-as-information-processing": "ecosystem/physics/",
    "paip1": "ecosystem/physics/",

    // Participate / programs
    "participation": "get-involved/",
    "fellowship": "programs/fellowship/",
    "internship": "programs/internship/",
    "mentorship": "programs/mentorship/",
    "partnership": "programs/partnership/",
    "volunteer": "volunteer/",
    "donate": "programs/philanthropy/",
    "support": "programs/philanthropy/",

    // Projects / groups
    "active-blockference": "projects/active-blockference/",
    "active-blockference-1": "projects/active-blockference/",
    "knowledge-engineering": "projects/knowledge-engineering/",
    "rxinfer": "projects/rxinfer/",
    "symposium": "projects/symposium/",
    "textbook-group": "projects/textbook-group/",
    "theoretical-neurobiology-group": "projects/theoretical-neurobiology/",
    "theoretical-neurobiology-group-1": "projects/theoretical-neurobiology/",
    "tnb": "projects/theoretical-neurobiology/"
  };

  // Non-default locale codes (mirrors src/i18n/locales.json minus "en"). Used
  // only to detect and re-attach a locale prefix around a PREFIX_REDIRECTS
  // match below -- MAP above stays English-only/locale-unaware by design,
  // since every Squarespace-era path it covers pre-dates the locale system.
  var LOCALE_CODES = ["ar", "de", "es", "fr", "hi", "it", "ja", "ko", "pt", "ru", "zh"];

  // Structural URL-taxonomy renames that apply uniformly across every locale
  // (unlike MAP's one-off English-only Squarespace aliases). Each entry moves
  // one routing family's whole output directory; add a rule here alongside
  // the matching entry in src/url-taxonomy.json when a routing family is
  // renamed. `from`/`to` are locale-agnostic path segments (no leading slash).
  //
  // v3.0.0 (2026-07-01): flattened "active-inference-and-<domain>/" pages
  // (16 of them, live at the time of the move) renested under
  // "active-inference/<domain>/" to make room for future domain growth
  // without cluttering the repository root. See
  // docs/SLUG_AND_URL_TAXONOMY.md and CHANGELOG.md v3.0.0.
  var PREFIX_REDIRECTS = [{ "from": "active-inference-and-", "to": "active-inference/" }];

  var script = document.currentScript;
  var base = (script && script.dataset && script.dataset.base) || "/";

  var path = location.pathname;
  if (base !== "/" && path.indexOf(base) === 0) {
    path = path.slice(base.length);
  } else {
    path = path.replace(/^\/+/, "");
  }

  var key;
  try {
    key = decodeURIComponent(path);
  } catch (e) {
    key = path;
  }
  key = key.replace(/\/+$/, "").replace(/\.html?$/i, "").toLowerCase();

  var dest = null;

  if (Object.prototype.hasOwnProperty.call(MAP, key)) {
    dest = MAP[key];
  } else {
    // Strip a leading locale segment (if present) before testing prefix
    // rules, and remember it so it can be re-attached to the destination.
    var localePrefix = "";
    var rest = key;
    for (var i = 0; i < LOCALE_CODES.length; i++) {
      var code = LOCALE_CODES[i];
      if (rest === code || rest.indexOf(code + "/") === 0) {
        localePrefix = code + "/";
        rest = rest.slice(code.length + 1);
        break;
      }
    }
    for (var j = 0; j < PREFIX_REDIRECTS.length; j++) {
      var rule = PREFIX_REDIRECTS[j];
      if (rest.indexOf(rule.from) === 0) {
        dest = localePrefix + rule.to + rest.slice(rule.from.length) + "/";
        break;
      }
    }
  }

  if (dest !== null) {
    var out = /^https?:\/\//.test(dest) ? dest : base + dest;
    // Avoid a no-op redirect to the same location.
    if (out !== location.pathname) {
      location.replace(out);
    }
  }
})();
