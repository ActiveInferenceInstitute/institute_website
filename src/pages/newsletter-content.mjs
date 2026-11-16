import { siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { relPrefix } from "../render/urls.mjs";
import { normalizePublicUrl } from "../public-links.mjs";

const TEXT_ENTITIES = { amp: "&", lt: "<", gt: ">" };

function decodeTextEntities(value) {
  return String(value || "").replace(/&(amp|lt|gt);/g, (_match, name) => TEXT_ENTITIES[name]);
}

function formatText(value) {
  let text = escapeHtml(decodeTextEntities(value));
  text = text.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>");
  return text;
}

function restoreTokens(text, tokens, prefix, field = "html") {
  return tokens.reduceRight((result, token, index) => result.replaceAll(`${prefix}${index}\uE001`, () => token[field]), text);
}

function mediaHref(target, record, currentDir) {
  const media = new Set(Array.isArray(record.media) ? record.media : []);
  if (!target.startsWith("media/") || !media.has(target)) {
    return "";
  }
  return `${relPrefix(currentDir)}assets/img/newsletters/${target.slice("media/".length)}`;
}

function safeHref(target, record, currentDir) {
  const clean = String(target || "").trim();
  if (clean === "site-contact") {
    return `mailto:${siteData.site.email}`;
  }
  const localMedia = mediaHref(clean, record, currentDir);
  if (localMedia) {
    return localMedia;
  }
  if (/^(https?:\/\/|mailto:|#)/i.test(clean)) {
    return normalizePublicUrl(clean);
  }
  return "";
}

function linkMarkup(label, target, record, currentDir, image = false) {
  const href = safeHref(target, record, currentDir);
  if (!href) {
    return image ? escapeHtml(label) : formatText(label);
  }
  if (image) {
    // A bare filename (e.g. "image.png", "Screenshot 2023-...png") or the
    // auto-generated "Substack image" boilerplate label is not meaningful alt
    // text for screen readers, so fall back to the descriptive site default.
    // (Non-empty alt is required by the static-security gate.)
    const alt = meaningfulAlt(label);
    return `<img class="newsletter-image" src="${escapeHtml(href)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  }
  const external = /^https?:\/\//i.test(href);
  const attrs = external
    ? ' data-newsletter-link="true" target="_blank" rel="noopener noreferrer"'
    : "";
  return `<a href="${escapeHtml(href)}"${attrs}>${formatText(label)}</a>`;
}

// Return descriptive alt text for a newsletter image. When the label is a bare
// image filename or the generic "image"/"Substack image" boilerplate (no real
// description), fall back to the meaningful site-wide default so every image has
// non-empty, sensible alt text (required by check:security).
function meaningfulAlt(label) {
  const clean = String(label || "").trim();
  if (!clean) return "Newsletter image";
  if (/^[\w\-. ]+\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(clean)) return "Newsletter image";
  if (/^(image|substack image|picture|photo|screenshot)$/i.test(clean)) return "Newsletter image";
  return clean;
}

function inlineMarkdown(value, record, currentDir) {
  let source = String(value || "");
  // Escapes/entity decoding cannot manufacture this punctuation-free namespace.
  let prefix = "\uE000NEWSLETTER";
  while (source.includes(prefix)) prefix += "X";
  const tokens = [];
  const stash = (html, plain) => {
    const marker = `${prefix}${tokens.length}\uE001`;
    tokens.push({ html, plain });
    return marker;
  };
  const plainText = (text) => restoreTokens(text, tokens, prefix, "plain");
  // Protect literal punctuation and code before recognizing Markdown structure.
  // Code retains its literal entities and backslashes; ordinary prose does not.
  source = source.replace(/\\([\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e])|(`+)(?!`)([\s\S]*?)(?<!`)\2(?!`)/g, (match, escaped, _fence, code) => {
    if (escaped) return stash(escapeHtml(escaped), escaped);
    const text = code.startsWith(" ") && code.endsWith(" ") && /\S/.test(code)
      ? code.slice(1, -1) : code;
    return stash(`<code>${escapeHtml(text)}</code>`, match);
  });
  source = source.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, (match, label, target) =>
    stash(linkMarkup(decodeTextEntities(plainText(label)), plainText(target), record, currentDir, true), match));
  source = source.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (match, label, target) =>
    stash(linkMarkup(label, plainText(target), record, currentDir), match));
  source = source.replace(/https?:\/\/[^\s<>]+/gi, (raw) => {
    const trailing = raw.match(/[.,;:!?]+$/)?.[0] || "";
    const label = trailing ? raw.slice(0, -trailing.length) : raw;
    const target = decodeTextEntities(plainText(label));
    return `${stash(linkMarkup(label, target, record, currentDir), label)}${formatText(trailing)}`;
  });
  return restoreTokens(formatText(source), tokens, prefix);
}

function renderNewsletterBody(markdown, record, currentDir) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const output = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      if (text) {
        output.push(`<p>${inlineMarkdown(text, record, currentDir)}</p>`);
      }
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!list) {
      return;
    }
    output.push(`</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) {
      return;
    }
    const text = quote.join(" ").trim();
    if (text) {
      output.push(`<blockquote><p>${inlineMarkdown(text, record, currentDir)}</p></blockquote>`);
    }
    quote = [];
  };
  const flushAll = () => {
    if (code) {
      output.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
      code = null;
    }
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (code) {
      const closing = line.match(/^\s*(`{3,})\s*$/);
      if (closing && closing[1].length >= code.fence) {
        output.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }
    const opening = line.match(/^\s*(`{3,})([^`]*)$/);
    if (opening) {
      flushAll();
      code = { fence: opening[1].length, lines: [] };
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 6);
      output.push(`<h${level}>${inlineMarkdown(heading[2], record, currentDir)}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      output.push("<hr>");
      continue;
    }
    const quoteLine = line.match(/^\s*>\s?(.*)$/);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]);
      continue;
    }
    const item = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/);
    if (item) {
      flushParagraph();
      flushQuote();
      const type = /^\s*\d+\./.test(line) ? "ol" : "ul";
      if (!list || list.type !== type) {
        flushList();
        output.push(`<${type}>`);
        list = { type };
      }
      output.push(`<li>${inlineMarkdown(item[1], record, currentDir)}</li>`);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();
  return output.join("\n");
}

export function newsletterBody(record, currentDir) {
  const html = renderNewsletterBody(record.body_markdown, record, currentDir);
  return html ? `<div class="newsletter-body">${html}</div>` : "<p>Full archived content is unavailable for this record.</p>";
}
