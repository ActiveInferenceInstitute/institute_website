import { escapeHtml } from "./lib/text.mjs";
import { loadJson, siteData } from "./data.mjs";
import { absoluteUrl } from "./render/urls.mjs";

function communicationsRecords() {
  let data;
  try {
    data = loadJson("instituteos/communications_public.json");
  } catch {
    return [];
  }
  const records = data.records || data.communications || [];
  // Newsletter-type communications have no rendered anchor on /knowledge/
  // (publications there use the substack-newsletter-<n> ids from
  // newsletter.json), so a `#publication-<id>` fragment for them is dead. The
  // actual newsletter issues enter the feed through newsletter.json rows (see
  // newsletterFeedRecords); here we keep the feed anchored only to items that
  // exist on the Open Source Map.
  return records.filter((record) => record.type !== "newsletter");
}

// Newsletter issues have rendered pages at /newsletter/<route>/ in every
// locale, so their feed entries link there instead of a knowledge anchor.
function newsletterFeedRecords() {
  let data;
  try {
    data = loadJson("instituteos/newsletter.json");
  } catch {
    return [];
  }
  return (data.records || []).filter((record) => record.route);
}

// Each communication's rendered anchor lives on the Open Source Map
// (/knowledge/) as `id="publication-<id>"`. Point feed items at that anchor so
// the link actually resolves to the content, rather than to a bare page root.
function publicationUrl(id) {
  return `${absoluteUrl("knowledge/index.html")}#publication-${id}`;
}

// A missing or malformed date would render "Invalid Date" in RSS and null in
// JSON Feed, so records without a parseable date are skipped entirely.
function parseFeedDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Unified feed items, newest first. The set is the merge of both sources with
// no additional cap, matching the previous all-records feed scope.
function feedItems() {
  const base = absoluteUrl("index.html");
  const items = [];
  for (const record of communicationsRecords()) {
    items.push({
      guid: `${base}#${record.id}`,
      link: publicationUrl(record.id),
      title: record.title || record.type || "Update",
      type: record.type || "update",
      date: parseFeedDate(record.date),
    });
  }
  for (const record of newsletterFeedRecords()) {
    const link = absoluteUrl(`newsletter/${record.route}/`);
    items.push({
      guid: link,
      link,
      title: record.title || record.type || "Update",
      type: record.type || "newsletter",
      date: parseFeedDate(record.date),
    });
  }
  return items
    .filter((item) => item.date && item.title)
    .sort((a, b) => b.date - a.date);
}

export function buildRssFeed() {
  const base = absoluteUrl("index.html");
  const items = feedItems();
  const lastBuildDate = items.length
    ? `    <lastBuildDate>${items[0].date.toUTCString()}</lastBuildDate>\n`
    : "";
  const itemXml = items
    .map(
      (item) => `    <item>
      <title>${escapeHtml(item.title)}</title>
      <link>${escapeHtml(item.link)}</link>
      <guid isPermaLink="false">${escapeHtml(item.guid)}</guid>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <category>${escapeHtml(item.type)}</category>
      <description>${escapeHtml(`${item.type}: ${item.title}`)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(siteData.site.name)} — Updates</title>
    <link>${escapeHtml(base)}</link>
    <atom:link href="${escapeHtml(absoluteUrl("feed.xml"))}" rel="self" type="application/rss+xml"/>
    <description>${escapeHtml(siteData.site.description)}</description>
    <language>en</language>
${lastBuildDate}${itemXml}
  </channel>
</rss>
`;
}

export function buildJsonFeed() {
  const base = absoluteUrl("index.html");
  return (
    JSON.stringify(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: `${siteData.site.name} — Updates`,
        home_page_url: base,
        feed_url: absoluteUrl("feed.json"),
        description: siteData.site.description,
        language: "en",
        items: feedItems().map((item) => ({
          id: item.guid,
          title: item.title,
          content_text: `${item.type}: ${item.title}`.trim(),
          date_published: item.date.toISOString(),
          url: item.link,
          tags: item.type ? [item.type] : [],
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
