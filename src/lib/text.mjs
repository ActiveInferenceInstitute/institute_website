// ── Text utilities ───────────────────────────────────────────────────────────
// Pure, dependency-free string helpers shared across the build. No site data,
// no DOM, no I/O — safe to unit-test in isolation.

// HTML-escape a value for safe interpolation into generated markup.
export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Public-safe prose normalizer for free-text sourced from registries/narratives.
// Strips markdown link syntax to its label, removes raw URLs, drops redacted
// email placeholders, and neutralizes private-channel/document tokens so the
// rendered HTML stays inside the public site contract (no Coda/workspace
// wording, no obsolete PDF/atlas references, no external anchors smuggled in as
// bare URLs). Output is plain text and must still be passed through escapeHtml.
export function sanitizePublicProse(value = "") {
  let text = String(value);
  // Markdown links/images -> visible label only.
  text = text.replace(/!?\[([^\]]*)\]\((?:[^)]*)\)/g, "$1");
  // Bare URLs -> removed (anchors must come from live-sources.json only).
  text = text.replace(/https?:\/\/[^\s)\]]+/g, "");
  // Redacted email placeholders and leftover empty brackets/parens.
  text = text.replace(/\[?\s*email redacted\s*\]?/gi, "");
  text = text.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
  // Neutralize tokens that trip the public-site scanners.
  const replacements = [
    [/\bcoda\.io\b/gi, "the shared space"],
    [/\bcoda\b/gi, "the shared space"],
    [/\bworkspaces?\b/gi, "shared spaces"],
    [/\bPDF\b/g, "document"],
    [/\bpdfs\b/gi, "documents"],
    [/\bSource Atlas\b/gi, "source map"],
    [/\bSource Manifest\b/gi, "source list"],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  // Clean up the grammatical residue left when entity mentions / links were
  // redacted upstream (empty emphasis, orphaned connectors, stray punctuation).
  // All rules are conservative — they only remove never-grammatical fragments,
  // never invent words.
  text = text
    .replace(/\*\*\s*\*\*/g, "") // empty bold "** **" from a stripped entity name
    .replace(/(^|[^*])\*[ \t]+\*(?!\*)/g, "$1") // empty italic "* *"
    .replace(/\bthe\s+and\b/gi, "the") // "guidance to the and People" -> "...to the People"
    .replace(/\b(and|the|of|to)\s+\1\b/gi, "$1") // de-dupe "and and" / "the the"
    .replace(/\(\s*\)/g, "") // empty parens
    .replace(/\[\s*\]/g, "") // empty brackets
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces
    .replace(/\s+([.,;:!?])/g, "$1") // space before punctuation
    .replace(/([,;:])\1+/g, "$1") // doubled punctuation
    .replace(/[ \t]+$/gm, ""); // trailing whitespace per line
  // Collapse markdown bullet artifacts and excess whitespace.
  text = text.replace(/\r/g, "");
  return text;
}

// Split a sanitized narrative body into renderable paragraphs. Markdown list
// markers and blank lines become paragraph breaks; empty fragments are dropped.
export function proseParagraphs(value = "") {
  const cleaned = sanitizePublicProse(value);
  return cleaned
    .split(/\n{2,}|\n(?=\s*[-*]\s)/)
    .map((chunk) =>
      chunk
        .split("\n")
        .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        .filter(Boolean)
        .join(" "),
    )
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

// Slugify a value into an anchor-safe token (lowercase, hyphen-separated).
export const slugifyAnchor = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Title-case a snake/kebab token for human-readable labels.
export function title_case_token_js(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
