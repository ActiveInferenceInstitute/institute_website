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
  return records.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function buildRssFeed() {
  const base = absoluteUrl("index.html");
  const updatesUrl = absoluteUrl("activities/index.html");
  const items = communicationsRecords()
    .map((communication) => {
      const title = communication.title || communication.type || "Update";
      const pubDate = new Date(`${communication.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${escapeHtml(updatesUrl)}</link>
      <guid isPermaLink="false">${escapeHtml(`${base}#${communication.id}`)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeHtml(communication.type || "update")}</category>
      <description>${escapeHtml(`${communication.type || "update"}: ${title}`)}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(siteData.site.name)} — Updates</title>
    <link>${escapeHtml(base)}</link>
    <atom:link href="${escapeHtml(absoluteUrl("feed.xml"))}" rel="self" type="application/rss+xml"/>
    <description>${escapeHtml(siteData.site.description)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

export function buildJsonFeed() {
  const base = absoluteUrl("index.html");
  const updatesUrl = absoluteUrl("activities/index.html");
  return (
    JSON.stringify(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: `${siteData.site.name} — Updates`,
        home_page_url: base,
        feed_url: absoluteUrl("feed.json"),
        description: siteData.site.description,
        language: "en",
        items: communicationsRecords().map((communication) => ({
          id: `${base}#${communication.id}`,
          title: communication.title || communication.type || "Update",
          content_text: `${communication.type || "update"}: ${communication.title || ""}`.trim(),
          date_published: new Date(`${communication.date}T00:00:00Z`).toISOString(),
          url: updatesUrl,
          tags: communication.type ? [communication.type] : [],
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
