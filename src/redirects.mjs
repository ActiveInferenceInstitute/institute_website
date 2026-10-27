import fs from "node:fs";
import { siteData, root } from "./data.mjs";
import { LOCALES, DEFAULT_LOCALE, tr, setActiveLocale } from "./i18n/index.mjs";
import { writeFile } from "./lib/output.mjs";
import { layout } from "./render/layout.mjs";
import { escapeHtml } from "./lib/text.mjs";
import { baseDirForSlug } from "./url-taxonomy.mjs";

const taxonomy = JSON.parse(fs.readFileSync(new URL("./url-taxonomy.json", import.meta.url), "utf8"));

export function redirectEntries() {
  const entries = new Map();
  const add = (from, to, file = `${from}/index.html`) => {
    if (entries.has(file) && entries.get(file).to !== to) throw new Error(`Conflicting redirect: ${file}`);
    entries.set(file, { from, to, file });
  };
  for (const locale of LOCALES) {
    const prefix = locale.code === DEFAULT_LOCALE ? "" : `${locale.code}/`;
    for (const [from, to] of Object.entries(taxonomy.redirects.map)) add(`${prefix}${from}`, `${prefix}${to}`);
    for (const rule of taxonomy.redirects.prefix) {
      for (const page of siteData.pages.filter((page) => page.slug.startsWith(rule.from))) {
        add(`${prefix}${page.slug}`, `${prefix}${baseDirForSlug(page.slug)}/`);
      }
    }
    for (const rule of taxonomy.redirects.set) add(`${prefix}${rule.from}`, `${prefix}${rule.to}`);
    if (prefix) {
      for (const file of fs.readdirSync(`${root}/simulations`).filter((file) => file.endsWith(".html") && file !== "index.html")) {
        add(`${prefix}simulations/${file}`, `simulations/${file}`, `${prefix}simulations/${file}`);
      }
    }
  }
  return [...entries.values()];
}

export function validateRedirect(entry, realFiles, stubs, outputRoot = root) {
  const target = entry.to.endsWith(".html") ? entry.to : `${entry.to}index.html`;
  const vendoredSimulation = /^simulations\/[^/]+\.html$/.test(target);
  if ((!realFiles.has(target) && !vendoredSimulation) || !fs.existsSync(`${outputRoot}/${target}`)) throw new Error(`Missing redirect destination: ${entry.to}`);
  if (stubs.some((stub) => stub.file === target)) throw new Error(`Redirect chain: ${entry.file}`);
  const existing = `${outputRoot}/${entry.file}`;
  if (fs.existsSync(existing) && !fs.readFileSync(existing, "utf8").includes('data-redirect-stub="true"')) {
    throw new Error(`Refusing to overwrite a real page: ${entry.file}`);
  }
}

export function buildRedirects(realFiles) {
  const stubs = redirectEntries().filter((entry) => !realFiles.has(entry.file));
  for (const entry of stubs) validateRedirect(entry, realFiles, stubs);
  for (const entry of stubs) {
    const code = entry.file.split("/")[0];
    setActiveLocale(LOCALES.some((locale) => locale.code === code) ? code : DEFAULT_LOCALE);
    const href = new URL(entry.to, siteData.site.baseUrl).pathname;
    const currentDir = entry.file.slice(0, entry.file.lastIndexOf("/"));
    writeFile(entry.file, layout({
      title: "Page moved", currentDir, canonicalPath: entry.to, robots: "noindex,follow",
      hreflang: false, refreshPath: href,
      body: `<section class="page-hero compact" data-redirect-stub="true"><h1>${escapeHtml(tr("Page moved"))}</h1><p><a href="${escapeHtml(href)}">${escapeHtml(tr("Continue to the current page"))}</a></p></section>`,
    }));
  }
  setActiveLocale(DEFAULT_LOCALE);
  const map = { ...taxonomy.redirects.map };
  for (const entry of stubs) {
    map[entry.from.replace(/\.html?$/i, "").toLowerCase()] = entry.to;
  }
  const runtime = fs.readFileSync(new URL("./redirect-runtime.js", import.meta.url), "utf8");
  writeFile("assets/js/redirects.js", `/* Generated from src/url-taxonomy.json and src/redirect-runtime.js. */\n(function () {\n  "use strict";\n  var MAP = ${JSON.stringify(map)};\n  var LOCALE_CODES = ${JSON.stringify(LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE).map((locale) => locale.code))};\n  var PREFIX_REDIRECTS = ${JSON.stringify(taxonomy.redirects.prefix)};\n  var SET_REDIRECTS = ${JSON.stringify(taxonomy.redirects.set)};\n${runtime}\n})();\n`);
  writeFile("data/redirects.json", JSON.stringify(stubs, null, 2) + "\n");
  const { forwards } = JSON.parse(fs.readFileSync(new URL("./content/inbound-forwards.json", import.meta.url), "utf8"));
  const docPath = "docs/MIGRATION_AND_REDIRECTS.md";
  const doc = fs.readFileSync(`${root}/${docPath}`, "utf8");
  const table = ["<!-- inbound-forwards:start -->", "| Subdomain | On-site destination |", "|---|---|", ...Object.entries(forwards).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([host, target]) => `| \`${host}\` | \`${target}\` |`), "<!-- inbound-forwards:end -->"].join("\n");
  if (!doc.includes("<!-- inbound-forwards:start -->") || !doc.includes("<!-- inbound-forwards:end -->")) throw new Error("Missing inbound-forward documentation markers");
  writeFile(docPath, doc.replace(/<!-- inbound-forwards:start -->[\s\S]*?<!-- inbound-forwards:end -->/, table));
  console.log(`Built ${stubs.length} static redirect stubs; preserved real routes.`);
  return stubs;
}
