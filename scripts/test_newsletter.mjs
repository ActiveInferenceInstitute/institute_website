import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { siteData } from "../src/data.mjs";
import { DEFAULT_LOCALE, setActiveLocale } from "../src/i18n/index.mjs";
import { newsletterIssuePage, newsletterPage, newsletterYearSection } from "../src/pages/newsletter.mjs";

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
