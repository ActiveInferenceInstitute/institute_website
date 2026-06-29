import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, slugifyAnchor } from "../lib/text.mjs";
import { sectionHeading } from "./components.mjs";
import { autolinkInternal } from "./autolink.mjs";

// Inline markdown -> safe HTML. Text is escaped FIRST; only **bold**/*italic*
// structure is then converted, and empty emphasis left behind by entity/link
// scrubbing (e.g. "** **") is removed. No raw HTML from the source ever passes.
function inlineMarkdown(text) {
  let t = escapeHtml(String(text));
  t = t.replace(/\*\*\s*\*\*/g, ""); // empty bold "** **" from scrubbed entities
  t = t.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>");
  t = t.replace(/\*+/g, ""); // strip any leftover stray asterisks
  t = t.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1"); // orphan heading markers (keeps "#1", "#001.1")
  return t.replace(/\s{2,}/g, " ").trim();
}

// Render a markdown pipe-table (with or without a --- separator row) as a table.
function renderNarrativeTable(rows) {
  const cells = rows.map((r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim()));
  const isSeparator = (r) => r.length > 0 && r.every((c) => /^:?-{1,}:?$/.test(c));
  let head = null;
  let body = cells;
  if (cells.length >= 2 && isSeparator(cells[1])) {
    head = cells[0];
    body = cells.slice(2);
  } else {
    body = cells.filter((r) => !isSeparator(r));
  }
  body = body.filter((r) => r.some((c) => c)); // drop fully-empty rows
  if (!body.length && !head) {
    return "";
  }
  const thead = head
    ? `<thead><tr>${head.map((c) => `<th scope="col">${inlineMarkdown(c)}</th>`).join("")}</tr></thead>`
    : "";
  const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="table-wrap"><table class="narrative-table">${thead}${tbody}</table></div>`;
}

// Render a transposed narrative body (light markdown: headings, pipe-tables,
// ordered/unordered lists, bold/italic, paragraphs) into safe, structured HTML.
// Replaces the previous behaviour of dumping each markdown line into an escaped
// <p>.
function renderNarrativeBody(rawBody) {
  const clean = sanitizePublicProse(String(rawBody || ""))
    // Put a heading marker that runs on mid-line onto its own line so it parses
    // as a heading instead of leaking "## Title" into a paragraph. Requires a
    // space after the hashes, so inline references like "#1"/"#001.1" are kept.
    .replace(/(\S)[ \t]*(#{1,6}[ \t]+)/g, "$1\n\n$2");
  const lines = clean.split("\n");
  const out = [];
  const lists = [];
  let table = [];
  const closeList = () => {
    const context = lists.pop();
    if (!context) {
      return;
    }
    if (context.liOpen) {
      out.push("</li>");
    }
    out.push(`</${context.type}>`);
  };
  const flushLists = () => {
    while (lists.length) {
      closeList();
    }
  };
  const openList = (type, indent) => {
    out.push(`<${type}>`);
    lists.push({ type, indent, liOpen: false });
  };
  const appendListItem = (type, indent, value) => {
    while (lists.length && indent < lists[lists.length - 1].indent) {
      closeList();
    }
    if (!lists.length || indent > lists[lists.length - 1].indent) {
      openList(type, indent);
    } else if (lists[lists.length - 1].type !== type) {
      closeList();
      openList(type, indent);
    }
    const current = lists[lists.length - 1];
    if (current.liOpen) {
      out.push("</li>");
    }
    out.push(`<li>${inlineMarkdown(value)}`);
    current.liOpen = true;
  };
  const flushTable = () => {
    if (table.length) {
      const html = renderNarrativeTable(table);
      if (html) {
        out.push(html);
      }
      table = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushLists();
      flushTable();
      continue;
    }
    if (line.startsWith("|")) {
      flushLists();
      table.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushLists();
      const level = Math.min(heading[1].length + 2, 6); // ## -> h4, ### -> h5
      const txt = inlineMarkdown(heading[2]);
      if (txt) {
        out.push(`<h${level}>${txt}</h${level}>`);
      }
      continue;
    }
    const item = raw.match(/^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/);
    if (item) {
      const value = item[4];
      if (inlineMarkdown(value)) {
        const indent = item[1].replace(/\t/g, "    ").length;
        appendListItem(item[2] ? "ul" : "ol", indent, value);
      }
      continue;
    }
    flushLists();
    const para = inlineMarkdown(line);
    if (para) {
      out.push(`<p>${para}</p>`);
    }
  }
  flushLists();
  flushTable();
  return out.join("\n");
}

// Narrative entries sanitized and grouped for a given target page. Bodies are
// transposed public Institute prose; markdown is rendered to safe HTML, and
// links/PII are scrubbed by sanitizePublicProse.
export function narrativesForTarget(targetPage) {
  return (siteData.instituteos.narratives.narratives || [])
    .filter((entry) => entry.target_page === targetPage)
    .map((entry) => ({
      section: entry.section,
      title: sanitizePublicProse(entry.title || entry.section || ""),
      html: renderNarrativeBody(entry.body || ""),
    }))
    .filter((entry) => entry.html);
}

// Render a narrative collection as one content-band with stacked prose blocks.
export function narrativeSection({ id, eyebrow, title, text, targetPage, currentDir = "" }) {
  const entries = narrativesForTarget(targetPage);
  if (!entries.length) {
    return "";
  }
  const blocks = entries
    .map((entry) => {
      return `<article class="article-block" id="${escapeHtml(slugifyAnchor(`narrative-${entry.section}-${entry.title}`))}">
            <h3>${escapeHtml(entry.title)}</h3>
            ${autolinkInternal(entry.html, currentDir)}
          </article>`;
    })
    .join("\n          ");
  return `<section class="content-band" id="${escapeHtml(id)}">
    ${sectionHeading({ eyebrow, title, text })}
    <div class="article-stack">
          ${blocks}
    </div>
  </section>`;
}
