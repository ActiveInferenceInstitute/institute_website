// ── Clean-URL taxonomy (single source of truth) ──────────────────────────────
// Maps a page slug to its output directory (a clean directory URL, no .html).
// The output file is always <dir>/index.html and the canonical URL is /<dir>/
// (root "" for the home page). 404 is special-cased as a flat root file in
// build() and is never routed here.
//
// This module is imported by src/build.mjs. The one piece of data that can drift
// across languages — the set of program-subpage slugs — lives in the committed
// url-taxonomy.json and is also read by scripts/check_site_contract.py, so the
// JS build and the Python contract checker share a single source for it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeLocale, DEFAULT_LOCALE } from "./i18n/index.mjs";

const _dir = path.dirname(fileURLToPath(import.meta.url));
const _data = JSON.parse(fs.readFileSync(path.join(_dir, "url-taxonomy.json"), "utf8"));

// Slugs that route under /programs/<slug>/ rather than /<slug>/.
export const PROGRAM_SUBPAGE_SLUGS = new Set(_data.programSubpageSlugs);

// Named slug-sets a "set" routing rule can reference (keeps the routing table in
// url-taxonomy.json data-driven while reusing the exported Set above).
const _SLUG_SETS = { programSubpageSlugs: PROGRAM_SUBPAGE_SLUGS };

// Ordered routing rules read from url-taxonomy.json (shared with the Python
// contract checker). Rules are evaluated in order and the FIRST match wins. A
// "prefix" rule strips the matched prefix and reroots the remainder under `dir`;
// a "set" rule reroots a whole named slug-set under `dir` (no strip).
const _ROUTING = _data.routing;

// Fail fast on a malformed routing table so a bad edit to url-taxonomy.json can
// never silently mis-route the site (e.g. an empty `match` would match every slug,
// or a `set` rule could reference a slug-set that does not exist).
(function validateRouting() {
  if (!_ROUTING || typeof _ROUTING.indexSlug !== "string" || !Array.isArray(_ROUTING.rules)) {
    throw new Error("url-taxonomy.json: routing must have an indexSlug string and a rules array");
  }
  for (const rule of _ROUTING.rules) {
    if (!rule || (rule.type !== "prefix" && rule.type !== "set") || !rule.match || typeof rule.dir !== "string") {
      throw new Error(
        `url-taxonomy.json: invalid routing rule ${JSON.stringify(rule)} ` +
          "(need type 'prefix'|'set', non-empty match, string dir)",
      );
    }
    if (rule.type === "set" && !_SLUG_SETS[rule.match]) {
      throw new Error(`url-taxonomy.json: set rule references unknown slug-set '${rule.match}'`);
    }
  }
})();

// Per-locale URL prefix. The default locale lives at the site root (""); every
// other locale gets its own self-contained subtree (e.g. "es/"). Because the
// prefix is applied to BOTH the current page dir and every link target, the
// existing relative-link math in hrefForSlug stays correct within a locale, and
// relPrefix still counts the extra segment so asset paths reach the true root.
export function localePrefix(code = activeLocale()) {
  return code && code !== DEFAULT_LOCALE ? `${code}/` : "";
}

// Locale-agnostic clean directory for a slug (no locale prefix). Mirrors the
// shared contract checker's url_dir_for_slug exactly.
export function baseDirForSlug(slug) {
  if (slug === _ROUTING.indexSlug) {
    return "";
  }
  for (const rule of _ROUTING.rules) {
    if (rule.type === "prefix" && slug.startsWith(rule.match)) {
      return `${rule.dir}${slug.slice(rule.match.length)}`;
    }
    if (rule.type === "set" && _SLUG_SETS[rule.match]?.has(slug)) {
      return `${rule.dir}${slug}`;
    }
  }
  // Fallback: about, structure, ecosystem, active-inference, learning, activities,
  // get-involved, volunteer, grants, eduactive, reinference, resources, directory,
  // knowledge, the domains pages -> root-level directory (/<slug>/).
  return slug;
}

// The slug's output directory under a SPECIFIC locale (defaults to the active
// locale). The home slug maps to "" at root, "<code>" for a non-default locale.
export function localeDirForSlug(slug, code = activeLocale()) {
  const base = baseDirForSlug(slug);
  const prefix = localePrefix(code);
  if (!base) {
    return prefix ? prefix.slice(0, -1) : "";
  }
  return `${prefix}${base}`;
}

// Active-locale clean directory for a slug. Every existing caller routes through
// here, so a single active-locale switch in the build relocates the whole site.
export function urlDirForSlug(slug) {
  return localeDirForSlug(slug, activeLocale());
}

// Strip the active locale prefix from a current page dir, yielding the
// locale-agnostic base dir. Code that infers page STRUCTURE from the dir (parent
// section for breadcrumbs / JSON-LD) must run on the base dir so the locale
// segment is not mistaken for a section slug.
export function stripLocalePrefix(currentDir = "", code = activeLocale()) {
  const prefix = localePrefix(code);
  if (prefix && (currentDir === prefix.slice(0, -1) || currentDir.startsWith(prefix))) {
    return currentDir.slice(prefix.length);
  }
  return currentDir;
}

// The output file path for a slug under a specific locale: <dir>/index.html
// (root index.html for the default-locale home, <code>/index.html otherwise).
export function localeOutputPathForSlug(slug, code = activeLocale()) {
  const dir = localeDirForSlug(slug, code);
  return dir ? `${dir}/index.html` : "index.html";
}

// The output file path for a slug under the active locale.
export function outputPathForSlug(slug) {
  return localeOutputPathForSlug(slug, activeLocale());
}

// Caller-relative clean href from the current page dir to the same slug in a
// DIFFERENT locale (the language switcher). Both dirs are absolute-from-root, so
// the relative result is valid regardless of how deep the current page sits.
export function crossLocaleHref(targetSlug, currentDir = "", code, anchor = "") {
  const targetDir = localeDirForSlug(targetSlug, code);
  let rel = path.posix.relative(currentDir, targetDir);
  if (rel === "") {
    rel = "./";
  }
  if (!rel.endsWith("/")) {
    rel += "/";
  }
  const hash = anchor ? (anchor.startsWith("#") ? anchor : `#${anchor}`) : "";
  return `${rel}${hash}`;
}

// Caller-relative clean href from the CURRENT page directory to a target slug.
// Always ends with "/" (the canonical directory URL). The home page resolves to
// the relative path back to the site root (e.g. "../../" from projects/<x>/).
// An optional #anchor is preserved verbatim.
export function hrefForSlug(targetSlug, currentDir = "", anchor = "") {
  const targetDir = urlDirForSlug(targetSlug);
  let rel = path.posix.relative(currentDir, targetDir);
  if (rel === "") {
    rel = "./";
  }
  if (!rel.endsWith("/")) {
    rel += "/";
  }
  const hash = anchor ? (anchor.startsWith("#") ? anchor : `#${anchor}`) : "";
  return `${rel}${hash}`;
}

// Parse a legacy "<slug>.html" or "<slug>.html#anchor" literal into its slug and
// optional anchor, so content authored with the old flat hrefs resolves through
// the taxonomy. Returns null when the value is not a flat-page literal.
export function parseFlatHref(value = "") {
  const match = /^([a-z0-9-]+)\.html(#.*)?$/i.exec(String(value).trim());
  if (!match) {
    return null;
  }
  return { slug: match[1], anchor: match[2] || "" };
}
