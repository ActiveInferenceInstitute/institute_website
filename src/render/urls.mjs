// ── URL resolution ───────────────────────────────────────────────────────────
// Caller-relative clean-URL helpers built on the slug->directory taxonomy. All
// derived load-time values here (SLUG_FOR_DIR, ROUTED_SLUG_SET) read only
// already-initialized data.mjs exports, so there is no value cycle.
import { siteData, liveSourceUrlSet, ALL_ROUTED_SLUGS } from "../data.mjs";
import { urlDirForSlug, hrefForSlug, parseFlatHref } from "../url-taxonomy.mjs";

export function isVerifiedExternalUrl(url = "") {
  if (!url) {
    return false;
  }
  return liveSourceUrlSet.has(url) || liveSourceUrlSet.has(url.replace(/\/+$/, ""));
}

// Backwards-compatible thin wrapper: slugToHref resolves a slug to a
// caller-relative clean directory URL. Every caller threads the CURRENT page dir.
export const slugToHref = (slug, currentDir = "", anchor = "") => hrefForSlug(slug, currentDir, anchor);

export const SLUG_FOR_DIR = (() => {
  const map = new Map();
  for (const slug of ALL_ROUTED_SLUGS) {
    map.set(urlDirForSlug(slug), slug);
  }
  return map;
})();
export const ROUTED_SLUG_SET = new Set(ALL_ROUTED_SLUGS);

// Resolve any author-supplied internal href to a caller-relative clean URL.
// Accepts:
//  - legacy "<slug>.html[#anchor]" literals (mapped via the taxonomy)
//  - root-absolute clean references "/<dir>/[#anchor]" (mapped back to a slug)
// and passes through external URLs, mailto/tel, bare "#anchor" fragments, and
// already-relative clean directory hrefs unchanged.
export function resolveInternalHref(href = "", currentDir = "") {
  if (!href || externalHref(href) || /^(mailto:|tel:|sms:|#)/i.test(href)) {
    return href;
  }
  const parsed = parseFlatHref(href);
  if (parsed) {
    return hrefForSlug(parsed.slug, currentDir, parsed.anchor);
  }
  // Root-absolute clean reference: "/projects/x/", "/about/", "/" (home).
  // Resolve by exact output dir first, then fall back to treating the final path
  // segment as a slug name (so "/partnership/" still maps to the program-subpage
  // slug whose real dir is "programs/partnership").
  if (href.startsWith("/")) {
    const [pathPart, anchorPart = ""] = href.split("#");
    const dir = pathPart.replace(/^\/+/, "").replace(/\/+$/, "");
    const anchor = anchorPart ? `#${anchorPart}` : "";
    const byDir = SLUG_FOR_DIR.get(dir);
    if (byDir) {
      return hrefForSlug(byDir, currentDir, anchor);
    }
    const lastSegment = dir.split("/").filter(Boolean).pop() || "index";
    if (ROUTED_SLUG_SET.has(lastSegment)) {
      return hrefForSlug(lastSegment, currentDir, anchor);
    }
  }
  return href;
}

// Asset/root prefix for the CURRENT page directory, generalized to N levels:
// the number of path segments in the dir determines how many "../" hops reach
// the site root. Root pages (dir "") get "". projects/<x>/ (depth 2) get "../../".
export function relPrefix(currentDir = "") {
  if (!currentDir) {
    return "";
  }
  const depth = currentDir.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}

export function absoluteUrl(filePath = "") {
  const baseUrl = siteData.site.baseUrl.endsWith("/") ? siteData.site.baseUrl : `${siteData.site.baseUrl}/`;
  let clean = String(filePath).replace(/^\/+/, "");
  if (clean === "index.html") {
    clean = "";
  } else if (clean.endsWith("/index.html")) {
    clean = clean.slice(0, -"index.html".length);
  }
  return new URL(clean, baseUrl).toString();
}

export function externalHref(href = "") {
  return /^https?:\/\//.test(href);
}
