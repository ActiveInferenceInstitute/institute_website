import { escapeHtml } from "../lib/text.mjs";

export function optionList(items) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
}
