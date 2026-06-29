#!/usr/bin/env node
// generate-cards.mjs — render a unique 1200x630 social-share card PNG per content page.
//
// Reads every src/content/pages/**/*.json to get {slug, title}, builds a brand SVG
// (dark #0a0a0a, 8px #ef4444 top rule, concentric-ring mark, wrapped white Helvetica
// bold title, "Act. Infer. Serve." tagline in #ef4444), then rasterizes each via
// rsvg-convert -w 1200 -h 630 to assets/img/cards/<slug>.png.
//
// Reproducible + idempotent: pure deterministic SVG from sorted inputs, re-running
// yields byte-identical PNGs. Programmatic pages (index/knowledge/resources/directory)
// are not under src/content/pages and fall back to the shared social-card.png.
//
// Usage: node scripts/generate-cards.mjs

import { readdirSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_DIR = join(ROOT, "src", "content", "pages");
const CARDS_DIR = join(ROOT, "assets", "img", "cards");

// --- input collection -------------------------------------------------------

function walkJson(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkJson(full));
    } else if (entry.endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

// --- text helpers -----------------------------------------------------------

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Wrap title to ~18-20 chars/line, max 4 lines, ellipsis if truncated.
function wrapTitle(title) {
  const MAX_CHARS = 20;
  const MAX_LINES = 4;
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= MAX_CHARS || !cur) {
      cur = candidate;
    } else {
      lines.push(cur);
      cur = word;
    }
    if (lines.length === MAX_LINES) break;
  }
  if (lines.length < MAX_LINES && cur) lines.push(cur);

  // Truncated: words remain beyond what fit, or final line overflows.
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length) {
    let last = lines[MAX_LINES - 1] ?? lines[lines.length - 1] ?? "";
    while (last.length > MAX_CHARS - 1 && last.includes(" ")) {
      last = last.slice(0, last.lastIndexOf(" "));
    }
    if (last.length > MAX_CHARS - 1) last = last.slice(0, MAX_CHARS - 1);
    lines[lines.length - 1] = last.replace(/\s+$/, "") + "…";
  }
  return lines.slice(0, MAX_LINES);
}

// --- SVG builder ------------------------------------------------------------

function buildSvg(title) {
  const lines = wrapTitle(title);

  // Font size scales down with line count so 4 lines stay in safe margins.
  const fontSize = lines.length >= 4 ? 64 : lines.length === 3 ? 72 : 80;
  const lineHeight = Math.round(fontSize * 1.18);

  // Text column starts right of the mark; vertically centered as a block.
  const textX = 360;
  const blockHeight = lines.length * lineHeight;
  const centerY = 300;
  const firstBaseline = Math.round(centerY - blockHeight / 2 + fontSize * 0.8);

  const titleTspans = lines
    .map((line, i) => {
      const y = firstBaseline + i * lineHeight;
      return `  <text x="${textX}" y="${y}" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const taglineY = Math.max(firstBaseline + lines.length * lineHeight + 30, 470);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect x="0" y="0" width="1200" height="8" fill="#ef4444"/>
  <g transform="translate(150 315)" fill="#ef4444">
    <rect x="-118" y="-104" width="236" height="40" rx="9"/>
    <rect x="-82" y="-64" width="40" height="156" rx="8"/>
    <rect x="42" y="-64" width="40" height="156" rx="8"/>
  </g>
${titleTspans}
  <text x="${textX + 2}" y="${taglineY}" fill="#ef4444" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="2">Act. Infer. Serve.</text>
</svg>
`;
}

// --- main -------------------------------------------------------------------

function main() {
  mkdirSync(CARDS_DIR, { recursive: true });

  const files = walkJson(PAGES_DIR);
  const pages = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (data.slug && data.title) {
      pages.push({ slug: data.slug, title: data.title });
    }
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  let count = 0;
  for (const { slug, title } of pages) {
    const svg = buildSvg(title);
    const out = join(CARDS_DIR, `${slug}.png`);
    execFileSync(
      "rsvg-convert",
      ["-w", "1200", "-h", "630", "-o", out],
      { input: svg },
    );
    count += 1;
  }

  process.stdout.write(`Generated ${count} social cards into assets/img/cards/\n`);
}

main();
