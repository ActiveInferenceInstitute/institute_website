// ── Link resolution ──────────────────────────────────────────────────────────
// Resolves author-supplied link descriptors (sourceId references or literal
// href/label pairs) against the verified live-source registry.
import { liveSourceById } from "../data.mjs";
import { externalHref } from "./urls.mjs";

export function linkAttrs(href = "") {
  return externalHref(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

export function sourceFor(id) {
  const source = liveSourceById.get(id);
  return source && source.ok ? source : null;
}

export function publicHrefForSource(source) {
  return source.url;
}

export function resolveLink(link) {
  if (!link) {
    return null;
  }
  if (link.sourceId) {
    const source = sourceFor(link.sourceId);
    if (!source) {
      return null;
    }
    return {
      label: link.label || source.label,
      href: publicHrefForSource(source),
      meta: source.category,
      external: true,
    };
  }
  if (link.href && link.label) {
    return {
      label: link.label,
      href: link.href,
      meta: link.meta,
      external: externalHref(link.href),
    };
  }
  return null;
}

export function resolveLinks(links = []) {
  return links.map(resolveLink).filter(Boolean);
}
