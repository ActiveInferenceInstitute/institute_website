import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { siteData } from "../src/data.mjs";
import { DEFAULT_LOCALE, setActiveLocale } from "../src/i18n/index.mjs";
import { newsletterIssuePage, newsletterPage, newsletterYearSection } from "../src/pages/newsletter.mjs";
import { newsletterBody } from "../src/pages/newsletter-content.mjs";

beforeEach(() => setActiveLocale(DEFAULT_LOCALE));

test("the archive exposes every published record once to the search controls", () => {
  const records = siteData.instituteos.newsletter.records;
  const page = newsletterPage();
  const ids = [...page.matchAll(/data-newsletter-id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids.toSorted(), records.map(record => record.id).toSorted());
  assert.equal(new Set(ids).size, records.length);
  assert.match(page, /id="newsletter-controls"[^>]*hidden/);
  assert.match(page, /id="newsletter-count"[^>]*role="status"/);
  assert.match(page, /assets\/js\/newsletter\.js/);
});

test("issue navigation reaches its real chronological neighbors in each locale", () => {
  const records = siteData.instituteos.newsletter.records;
  for (const locale of ["en", "fr", "ar"]) {
    setActiveLocale(locale);
    for (const [index, record] of records.entries()) {
      const page = newsletterIssuePage(record);
      const nav = page.match(/<nav class="pager newsletter-pager"[^>]*>(.*?)<\/nav>/s)?.[1] || "";
      const links = new Map([...nav.matchAll(/<a rel="(prev|next)" href="([^"]+)"/g)].map(match => [match[1], match[2]]));
      const prefix = locale === "en" ? "" : `${locale}/`;
      for (const [rel, neighbor] of [["prev", records[index + 1]], ["next", records[index - 1]]]) {
        assert.equal(links.has(rel), Boolean(neighbor));
        if (neighbor) {
          const url = new URL(links.get(rel), `https://activeinference.institute/${prefix}newsletter/${record.route}/`);
          assert.equal(url.pathname, `/${prefix}newsletter/${neighbor.route}/`);
        }
      }
      assert.doesNotMatch(page, /assets\/js\/newsletter\.js/);
    }
  }
});

test("year summaries contain the latest monthly issues from that year only", () => {
  for (const year of ["2025", "2026"]) {
    const expected = siteData.instituteos.newsletter.records.filter(record => record.type === "newsletter" && record.date.startsWith(year + "-")).slice(0, 3);
    const section = newsletterYearSection(year, `years/${year}`);
    const hrefs = [...section.matchAll(/<h3><a href="([^"]+)"/g)].map(match => new URL(match[1], `https://activeinference.institute/years/${year}/`).pathname);
    assert.deepEqual(hrefs, expected.map(record => `/newsletter/${record.route}/`));
    assert.match(section, new RegExp("year=" + year));
  }
  assert.equal(newsletterYearSection("2100", "years/2100"), "");
});

test("archive prose decodes producer entities once and preserves escaped punctuation", () => {
  const body = newsletterBody({
    body_markdown: String.raw`Public text &amp; café. &lt;tag&gt; &amp;amp; \_name\_ \[label\] \*literal\*`,
  }, "");
  assert.equal(body, '<div class="newsletter-body"><p>Public text &amp; café. &lt;tag&gt; &amp;amp; _name_ [label] *literal*</p></div>');
});

test("escaped Markdown and encoded HTML cannot become active markup", () => {
  const body = newsletterBody({
    body_markdown: String.raw`\!\[image\]\(javascript:alert\(1\)\) &lt;script&gt;bad&lt;/script&gt; <img src=x onerror=bad>`,
  }, "");
  assert.doesNotMatch(body, /<(?:a|img|script)\b/);
  assert.match(body, /!\[image\]\(javascript:alert\(1\)\)/);
  assert.match(body, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(body, /&lt;img src=x onerror=bad&gt;/);
});

test("code spans preserve literal entities and punctuation with producer-selected fences", () => {
  for (const markdown of ["` \\\\_ &amp; <tag> **literal** `", "`` a `b` \\\\_ &amp; ``"]) {
    const body = newsletterBody({ body_markdown: markdown }, "");
    const expected = markdown.startsWith("``")
      ? "a `b` \\\\_ &amp;amp;" : "\\\\_ &amp;amp; &lt;tag&gt; **literal**";
    assert.equal(body, `<div class="newsletter-body"><p><code>${expected}</code></p></div>`);
  }
});

test("real Markdown keeps escaped labels, URL queries and declared image alt text intact", () => {
  const body = newsletterBody({
    body_markdown: String.raw`**A &amp; B \*literal\*** [A &amp; \[B\]](https://activeinference.institute/?a=1&b=2) ![A &amp; \[B\]](media/example.png)`,
    media: ["media/example.png"],
  }, "");
  assert.match(body, /<strong>A &amp; B \*literal\*<\/strong>/);
  const href = body.match(/<a href="([^"]+)"/)?.[1].replaceAll("&amp;", "&");
  assert.equal(new URL(href, "https://activeinference.institute/").href, "https://activeinference.institute/?a=1&b=2");
  assert.match(body, />A &amp; \[B\]<\/a>/);
  assert.match(body, /alt="A &amp; \[B\]"/);
});

test("source text cannot impersonate internal newsletter rendering tokens", () => {
  const marker = "\uE000NEWSLETTER_0\uE001";
  const body = newsletterBody({ body_markdown: `${marker} \\*literal\\*` }, "");
  assert.equal(body, `<div class="newsletter-body"><p>${marker} *literal*</p></div>`);
});

test("undeclared image alt text stays literal without a second entity decode", () => {
  const body = newsletterBody({
    body_markdown: String.raw`![Literal &amp;amp; \*name\*](media/missing.png)`,
    media: [],
  }, "");
  assert.equal(body, '<div class="newsletter-body"><p>Literal &amp;amp; *name*</p></div>');
});

test("explicit producer destinations retain literal entity-looking path text", () => {
  for (const entity of ["amp", "lt", "gt"]) {
    const target = `https://example.org/A&${entity};B`;
    const body = newsletterBody({ body_markdown: `[go](${target})` }, "");
    const href = body.match(/<a href="([^"]+)"/)?.[1].replaceAll("&amp;", "&");
    assert.equal(new URL(href, "https://activeinference.institute/").href, target);
  }
});

test("producer-escaped marker text cannot become a second code span", () => {
  const marker = "\uE000NEWSLETTER_0\uE001";
  const body = newsletterBody({ body_markdown: "` x ` " + marker.replace("_", "\\_") }, "");
  assert.equal(body, `<div class="newsletter-body"><p><code>x</code> ${marker}</p></div>`);
});

test("producer-selected inline and block fence lengths preserve their code", () => {
  const inline = newsletterBody({ body_markdown: "``` a ``b`` ```" }, "");
  assert.equal(inline, '<div class="newsletter-body"><p><code>a ``b``</code></p></div>');
  const block = newsletterBody({ body_markdown: "````\nbefore\n```\nafter\n````" }, "");
  assert.equal(block, '<div class="newsletter-body"><pre><code>before\n```\nafter</code></pre></div>');
});

test("direct unsafe Markdown destinations never become active links or images", () => {
  for (const target of ["javascript:alert", "data:text/html,bad"]) {
    const body = newsletterBody({ body_markdown: `[label](${target}) ![image](${target})` }, "");
    assert.doesNotMatch(body, /<(?:a|img)\b/);
    assert.match(body, /label image/);
  }
});
