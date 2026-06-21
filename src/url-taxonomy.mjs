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

const _dir = path.dirname(fileURLToPath(import.meta.url));
const _data = JSON.parse(fs.readFileSync(path.join(_dir, "url-taxonomy.json"), "utf8"));

// Slugs that route under /programs/<slug>/ rather than /<slug>/.
export const PROGRAM_SUBPAGE_SLUGS = new Set(_data.programSubpageSlugs);

export function urlDirForSlug(slug) {
  if (slug === "index") {
    return "";
  }
  if (slug.startsWith("project-")) {
    return `projects/${slug.slice("project-".length)}`;
  }
  if (PROGRAM_SUBPAGE_SLUGS.has(slug)) {
    return `programs/${slug}`;
  }
  // projects, programs, about, structure, ecosystem, active-inference, learning,
  // activities, get-involved, volunteer, grants, edactive, reinference,
  // resources, directory, knowledge -> root-level directory.
  return slug;
}

// The output file path for a slug: <dir>/index.html (root index.html for home).
export function outputPathForSlug(slug) {
  const dir = urlDirForSlug(slug);
  return dir ? `${dir}/index.html` : "index.html";
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
