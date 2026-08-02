import { siteData } from "../data.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { relPrefix } from "../render/urls.mjs";

const TOKEN_PREFIX = "\uE000NEWSLETTER_";

function formatText(value) {
  let text = escapeHtml(String(value || ""));
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>");
  return text;
}

function restoreTokens(text, tokens) {
  return tokens.reduce((result, token, index) => result.replaceAll(`${TOKEN_PREFIX}${index}\uE001`, token), text);
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
    return clean;
  }
  return "";
}

function linkMarkup(label, target, record, currentDir, image = false) {
  const href = safeHref(target, record, currentDir);
  if (!href) {
    return formatText(label);
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
  const tokens = [];
  const stash = (html) => {
    const marker = `${TOKEN_PREFIX}${tokens.length}\uE001`;
    tokens.push(html);
    return marker;
  };
  source = source.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, (_match, label, target) => stash(linkMarkup(label, target, record, currentDir, true)));
  source = source.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (_match, label, target) => stash(linkMarkup(label, target, record, currentDir)));
  source = source.replace(/https?:\/\/[^\s<>]+/gi, (raw) => {
    const trailing = raw.match(/[.,;:!?]+$/)?.[0] || "";
    const target = trailing ? raw.slice(0, -trailing.length) : raw;
    return `${stash(linkMarkup(target, target, record, currentDir))}${formatText(trailing)}`;
  });
  return restoreTokens(formatText(source), tokens);
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
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      code = null;
    }
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (code) {
      if (line.trim().startsWith("```")) {
        output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushAll();
      code = [];
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
