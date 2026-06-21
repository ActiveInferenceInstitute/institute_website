import { escapeHtml } from "../lib/text.mjs";
import { sourceFor, publicHrefForSource, linkAttrs } from "./links.mjs";

export function sourceAnchor(sourceId, label) {
  const source = sourceFor(sourceId);
  if (!source) {
    return escapeHtml(label);
  }
  const href = publicHrefForSource(source);
  return `<a href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(label)}</a>`;
}
