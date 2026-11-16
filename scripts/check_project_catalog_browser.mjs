import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { browserSession } from "./browser_session.mjs";
import { createEvidenceDirectory } from "./check_browser_suite.mjs";
import { projectCatalogFixture } from "./project_catalog_fixture.mjs";
import { loadProjectsData } from "../src/data.mjs";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES, localeMeta, setActiveLocale, tr } from "../src/i18n/index.mjs";
import { projectCatalogSection } from "../src/pages/projects.mjs";
import { escapeHtml } from "../src/lib/text.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidenceParent = process.env.WEBSITE_AUDIT_OUTPUT;
assert.ok(process.env.CHROME_BIN, "Set CHROME_BIN to the admitted existing Chrome executable");
assert.ok(evidenceParent, "Set WEBSITE_AUDIT_OUTPUT to a private evidence directory");
const output = createEvidenceDirectory(root, evidenceParent);
const fixtures = new Map();
const messages = new Map();
const data = loadProjectsData();
const originalProjects = data.projects;
try {
  data.projects = projectCatalogFixture();
  for (const { code } of NON_DEFAULT_LOCALES) {
    setActiveLocale(code);
    fixtures.set(`/__catalog-fixture/${code}/`, `<!doctype html><html lang="${code}" dir="${localeMeta(code).dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/styles.css"><title>Catalog fixture</title></head><body><main>${projectCatalogSection(`${code}/projects`)}</main><script src="/assets/js/site.js" defer></script></body></html>`);
    messages.set(code, {
      count: tr("{n} projects"), shown: tr("{n} projects shown"),
      groups: Object.fromEntries(["institute", "ecosystem"].map(group => {
        const name = group === "institute" ? "institute-hosted" : "ecosystem";
        return [group, { search: tr(`Search ${name} projects`), topic: tr(`Filter ${name} projects by topic`) }];
      })),
    });
  }
} finally {
  data.projects = originalProjects;
  setActiveLocale(DEFAULT_LOCALE);
}
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (fixtures.has(url.pathname)) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(fixtures.get(url.pathname));
      return;
    }
    const file = resolve(root, "." + decodeURIComponent(url.pathname) + (url.pathname.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403); response.end(); return;
    }
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(escapeHtml(error.message));
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const receipts = [];

function exerciseCatalog(expected, fixture, interactive) {
  const require = (ok, message) => { if (!ok) throw new Error(message); };
  const format = (pattern, n) => pattern.replace("{n}", new Intl.NumberFormat(document.documentElement.lang).format(n));
  const state = anchor => {
    const section = document.getElementById(anchor);
    require(section, `Missing ${anchor}`);
    return {
      counts: [...section.querySelectorAll(".catalog-subcount")].map(e => e.textContent),
      rows: [...section.querySelectorAll("[data-catalog-row]")].map(e => ({ text: e.textContent, hidden: e.hidden })),
      total: document.getElementById(anchor + "-count").textContent,
    };
  };
  const result = [];
  for (const group of ["institute", "ecosystem"]) {
    const anchor = "catalog-" + group;
    const other = "catalog-" + (group === "institute" ? "ecosystem" : "institute");
    const section = document.getElementById(anchor);
    require(section, `Missing affiliation ${group}`);
    const search = document.getElementById(anchor + "-search");
    const topic = document.getElementById(anchor + "-topic");
    require(search.getAttribute("aria-label") === expected.groups[group].search, "Search accessible name not localized");
    require(topic.getAttribute("aria-label") === expected.groups[group].topic, "Topic accessible name not localized");
    for (const table of section.querySelectorAll(".catalog-table")) {
      const count = document.getElementById(table.id.replace(/-table$/, "-count"));
      require(count.textContent === format(expected.count, table.querySelectorAll("[data-catalog-row]").length), "Initial count differs from locale pattern");
    }
    if (!interactive) { result.push({ group, state: state(anchor) }); continue; }
    const unchanged = JSON.stringify(state(other));
    const change = (query, value = "") => {
      search.value = query; topic.value = value;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      topic.dispatchEvent(new Event("change", { bubbles: true }));
      let visible = 0;
      for (const table of section.querySelectorAll(".catalog-table")) {
        const n = [...table.querySelectorAll("[data-catalog-row]")].filter(row => !row.hidden).length;
        visible += n;
        require(document.getElementById(table.id.replace(/-table$/, "-count")).textContent === format(expected.count, n), "Filtered count not localized");
        require(document.getElementById(table.id.replace(/-table$/, "-empty")).hidden === (n !== 0), "Empty state disagrees with rows");
        require(table.closest(".table-wrap").hidden === (n === 0), "Empty table remains exposed");
      }
      require(document.getElementById(anchor + "-count").textContent === (query || value ? format(expected.shown, visible) : ""), "Live count disagrees with rows");
      require(JSON.stringify(state(other)) === unchanged, "Filtering crossed affiliation boundary");
      return visible;
    };
    require(change("zzznomatchcatalog") === 0, "Zero-match search still shows rows");
    require(change('<img src=x onerror="window.catalogInjected=1">') === 0, "Markup-like query unexpectedly matched");
    require(!window.catalogInjected, "Query was treated as executable markup");
    if (fixture) {
      require(change(group === "institute" ? "alpha" : "delta") === 1, "Unique registry handle search failed");
      require(change("active inference") === 3, "Many-match search failed");
      require(change("", group + "-only") === 2, "Per-affiliation topic filtering failed");
      require(change("", "active-inference") === 3, "Machine topic key changed");
    }
    const restored = change("");
    require(restored === section.querySelectorAll("[data-catalog-row]").length, "Reset did not restore every project");
    result.push({ group, restored, independent: true, state: state(anchor) });
  }
  require(!document.querySelector("main img[src=x]"), "Registry markup was not escaped");
  return { locale: document.documentElement.lang, interactive, fixture, result };
}

async function browse(path, code, { fixture = false, noJs = false, screenshot = false } = {}) {
  const run = await browserSession(process.env.CHROME_BIN, async ({ command, evaluate, events }) => {
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    if (noJs) await command("Emulation.setScriptExecutionDisabled", { value: true });
    await command("Page.navigate", { url: origin + path });
    let loaded = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('document.readyState === "complete"')) { loaded = true; break; }
      await new Promise(done => setTimeout(done, 50));
    }
    assert.ok(loaded, "Catalog page did not finish loading");
    const receipt = await evaluate(`(${exerciseCatalog.toString()})(${JSON.stringify(messages.get(code))},${fixture},${!noJs})`);
    assert.equal(receipt.locale, code);
    assert.deepEqual(events.filter(e => e.method === "Runtime.exceptionThrown"), [], "Unexpected browser exception");
    if (screenshot) {
      await evaluate('document.getElementById("catalog-institute").scrollIntoView({block:"start",behavior:"instant"})');
      const image = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(resolve(output, `catalog-${code}.png`), Buffer.from(image.data, "base64"));
    }
    return receipt;
  });
  receipts.push({ path, noJs, ...run.result });
}
try {
  for (const { code } of NON_DEFAULT_LOCALES) {
    await browse(`/__catalog-fixture/${code}/`, code, { fixture: true, noJs: true });
    await browse(`/__catalog-fixture/${code}/`, code, { fixture: true });
  }
  // These are generated production pages, not a substitute fixture or a rebuilt copy.
  for (const code of ["es", "ar"]) await browse(`/${code}/projects/`, code, { screenshot: true });
  await writeFile(resolve(output, "catalog-browser-receipts.json"), JSON.stringify({ scope: "All locale fixture counts/filters plus generated Spanish and Arabic project pages", receipts }, null, 2) + "\n");
  console.log(`Verified ${receipts.length} real-browser catalog scenarios; evidence ${output}`);
} catch (error) {
  await writeFile(resolve(output, "catalog-browser-partial.json"), JSON.stringify({ error: error.message, receipts }, null, 2) + "\n");
  throw error;
} finally {
  await new Promise(done => server.close(done));
}
