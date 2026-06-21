// ── Render text helpers ──────────────────────────────────────────────────────
// Small render-layer string helpers built on the pure text utilities.
import { slugifyAnchor } from "../lib/text.mjs";

export function listText(items = [], fallback = "None listed") {
  const cleaned = items.map((item) => String(item || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : fallback;
}

export function rowAnchor(prefix, id) {
  return `${prefix}-${slugifyAnchor(id)}`;
}
