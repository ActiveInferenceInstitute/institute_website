import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hrefForSlug, urlDirForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";
import { absoluteUrl } from "../render/urls.mjs";

const _dir = path.dirname(fileURLToPath(import.meta.url));
const transcriptDir = path.join(_dir, "..", "content", "video-transcripts");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso) {
  const s = String(iso || "");
  if (s.length < 10) return s || "Undated";
  const month = MONTHS[Number(s.slice(5, 7)) - 1] || "";
  const day = String(Number(s.slice(8, 10)) || "");
  const year = s.slice(0, 4);
  return `${month} ${day}, ${year}`;
}

/** Load all video transcript records keyed by video id. */
export function loadVideoRecords() {
  const records = [];
  if (!fs.existsSync(transcriptDir)) return records;
  for (const entry of fs.readdirSync(transcriptDir)) {
    if (!entry.endsWith(".json")) continue;
    const full = path.join(transcriptDir, entry);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      if (data.id) records.push(data);
    } catch {
      // skip malformed files
    }
  }
  return records;
}

/** Map from video page slug (video-<id>) to record. */
let _recordsBySlug = null;
export function videoRecordBySlug(slug) {
  if (_recordsBySlug === null) {
    _recordsBySlug = new Map(
      loadVideoRecords().map((r) => [`video-${r.id}`, r]),
    );
  }
  return _recordsBySlug.get(slug) || null;
}

/** All video page slugs registered for sitemap/build. */
export function allVideoSlugs() {
  return loadVideoRecords().map((r) => `video-${r.id}`);
}

/**
 * Build Schema.org VideoObject JSON-LD for a video detail page.
 * Provides crawlers with structured metadata about the recording.
 * Google's VideoObject rich result requires a crawlable thumbnailUrl, so we
 * derive it from the YouTube id (img.youtube.com) with a fallback to the
 * site social card when the id is absent.
 */
function videoObjectSchema(record, canonicalUrl) {
  // Google's VideoObject rich result requires a crawlable thumbnailUrl. We derive
  // it from the YouTube id. maxresdefault (1280x720) is not published for every
  // video, so we use sddefault (640x360), which YouTube serves for all videos and
  // which meets Google's >=640px thumbnail guidance. Falls back to the site social
  // card for the rare record lacking a youtube id. Build stays offline/deterministic.
  const thumbnail =
    (record.youtubeId && `https://img.youtube.com/vi/${record.youtubeId}/sddefault.jpg`) ||
    absoluteUrl("assets/img/social-card.png");
  const obj = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${canonicalUrl}#video`,
    name: record.title || "Video session",
    description: record.transcriptExcerpt
      ? record.transcriptExcerpt.slice(0, 300).replace(/\s+/g, " ").trim() + "…"
      : `Recorded session from ${record.series || "the Institute"}.`,
    uploadDate: record.date || "",
    thumbnailUrl: thumbnail,
  };
  if (record.youtubeUrl) {
    obj.embedUrl = record.youtubeUrl.replace("/live/", "/embed/").replace("watch?v=", "embed/");
    obj.url = record.youtubeUrl;
  }
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Build a rich meta description from the video record.
 * Uses transcript excerpt when available, falls back to metadata.
 */
function buildDescription(record) {
  const title = record.title || "Video session";
  const seriesLabel = [record.series, record.number].filter(Boolean).join(" ");
  const guestNames = (record.guests || []).filter(Boolean);
  const guestList = guestNames.length ? guestNames.join(", ") : "";

  // Use transcript excerpt first ~155 chars as description for SEO
  if (record.transcriptExcerpt) {
    const clean = record.transcriptExcerpt.replace(/\s+/g, " ").trim();
    if (clean.length > 160) return clean.slice(0, 157).replace(/\s+\S*$/, "") + "…";
    return clean;
  }

  // Fallback: metadata-based description
  const parts = [title];
  if (seriesLabel) parts.push(`from ${seriesLabel}`);
  if (guestList) parts.push(`with ${guestList}`);
  if (record.date) parts.push(`(${record.date})`);
  return parts.join(" ") + ".";
}

/**
 * Render a single video detail page.
 * @param {object} record - The video transcript record
 * @returns {string} HTML
 */
export function videoDetailPage(record) {
  const slug = `video-${record.id}`;
  const currentDir = urlDirForSlug(slug);
  const seriesLabel = [record.series, record.number].filter(Boolean).join(" ");
  const dateStr = formatDate(record.date);
  const canonicalUrl = absoluteUrl(`${currentDir}/`).replace(/\/+$/, "/");

  const guestNames = (record.guests || []).filter(Boolean);
  const guestList = guestNames.length
    ? guestNames.map((n) => escapeHtml(n)).join(", ")
    : "";

  // YouTube link
  const youtubeLink = record.youtubeUrl
    ? `<a class="button primary" href="${escapeHtml(record.youtubeUrl)}" target="_blank" rel="noopener noreferrer">▶ Watch on YouTube ↗</a>`
    : "";

  // Transcript section
  let transcriptSection = "";
  if (record.hasTranscript && record.transcriptExcerpt) {
    transcriptSection = `
  <section class="content-band" id="transcript">
    ${sectionHeading({
      eyebrow: "Transcript",
      title: "AI-generated transcript excerpt",
      text: "The full transcript is available on GitHub. This excerpt is generated by automated speech recognition and may contain errors.",
    })}
    <div class="transcript-block">
      <p>${escapeHtml(record.transcriptExcerpt)}</p>
    </div>
    ${
      record.transcriptSource
        ? `<p class="section-link"><a href="${escapeHtml(record.transcriptSource)}" target="_blank" rel="noopener noreferrer">View full transcript on GitHub ↗</a></p>`
        : ""
    }
  </section>`;
  } else if (record.hasTranscript) {
    transcriptSection = `
  <section class="content-band" id="transcript">
    ${sectionHeading({
      eyebrow: "Transcript",
      title: "Transcript available",
      text: "A transcript is available for this session.",
    })}
    ${
      record.transcriptSource
        ? `<p class="section-link"><a href="${escapeHtml(record.transcriptSource)}" target="_blank" rel="noopener noreferrer">View transcript on GitHub ↗</a></p>`
        : ""
    }
  </section>`;
  }

  // Keywords/topics
  const keywords = (record.keywords || []).filter(Boolean);
  const ontologyTerms = (record.ontologyTerms || []).filter(Boolean);
  const topicTags = [...keywords, ...ontologyTerms.map((t) => t.replace(/^term-/, "").replace(/-/g, " "))];
  const topicSection =
    topicTags.length > 0
      ? `<div class="tag-row">${topicTags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
      : "";

  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${hrefForSlug("index", currentDir)}">Home</a>
      <span aria-hidden="true">/</span>
      <a href="${hrefForSlug("video", currentDir)}">Videos and Podcasts</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">${escapeHtml(record.title || "Untitled")}</span>
    </nav>
    <p class="eyebrow">${escapeHtml(seriesLabel || "Video session")}</p>
    <h1>${escapeHtml(record.title || "Untitled")}</h1>
    <p>${escapeHtml(dateStr)}${guestList ? ` · with ${guestList}` : ""}</p>
    ${youtubeLink}
  </section>

  <section class="content-band muted">
    <div class="resource-grid compact-grid">
      <article class="info-card">
        <h3>Session details</h3>
        <p><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
        ${seriesLabel ? `<p><strong>Series:</strong> ${escapeHtml(seriesLabel)}</p>` : ""}
        ${guestList ? `<p><strong>Guests:</strong> ${escapeHtml(guestList)}</p>` : ""}
        ${record.paperTitle ? `<p><strong>Paper:</strong> ${escapeHtml(record.paperTitle)}</p>` : ""}
      </article>
      <article class="info-card">
        <h3>Watch and follow up</h3>
        ${record.youtubeUrl ? `<p><a href="${escapeHtml(record.youtubeUrl)}" target="_blank" rel="noopener noreferrer">▶ Watch on YouTube ↗</a></p>` : ""}
        ${record.githubUrl ? `<p><a href="${escapeHtml(record.githubUrl)}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a></p>` : ""}
        <p><a href="${hrefForSlug("video", currentDir)}">← Back to video library</a></p>
      </article>
    </div>
    ${topicSection}
  </section>

  ${transcriptSection}
  ${videoObjectSchema(record, canonicalUrl)}

  <section class="content-band" id="related">
    ${sectionHeading({
      eyebrow: "Continue",
      title: "More from the video library",
      text: "Browse the complete library or find more sessions in this series.",
    })}
    <div class="link-chips">
      <a href="${hrefForSlug("video", currentDir)}"><span>All videos</span></a>
      <a href="${hrefForSlug("activities", currentDir)}"><span>Activities</span></a>
      <a href="${hrefForSlug("learning", currentDir)}"><span>Learning</span></a>
    </div>
  </section>`;

  return layout({
    title: record.title || "Video session",
    description: buildDescription(record),
    currentDir,
    body,
    slug,
    ogType: "video.other",
  });
}
