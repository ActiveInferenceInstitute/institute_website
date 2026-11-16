import { readFileSync } from "node:fs";
import { NON_DEFAULT_LOCALES } from "../src/i18n/index.mjs";

const catalogs = new URL("../src/content/i18n/", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, catalogs), "utf8"));
const markers = (text) => (text.match(/\{[A-Za-z][\w]*\}/g) || []).sort().join("\n");
const paragraphs = (text) => text.trim().split(/\r?\n(?:[ \t]*\r?\n)+/).length;
const source = readJson("_strings.json");
if (!Array.isArray(source) || !source.length || source.some((key) => typeof key !== "string")) {
  throw new Error("Malformed extracted i18n source keys");
}
const keys = new Set(source);

const summary = NON_DEFAULT_LOCALES.map(({ code }) => {
  const catalog = readJson(`${code}.json`);
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error(`Malformed translation catalog: ${code}`);
  }
  const missing = [];
  const empty = [];
  const placeholderMismatch = [];
  const paragraphMismatch = [];
  for (const key of keys) {
    if (!Object.hasOwn(catalog, key)) {
      missing.push(key);
      continue;
    }
    const value = catalog[key];
    if (typeof value !== "string" || !value.trim()) {
      empty.push(key);
      continue;
    }
    if (markers(key) !== markers(value)) placeholderMismatch.push(key);
    if (paragraphs(key) !== paragraphs(value)) paragraphMismatch.push(key);
  }
  const obsolete = Object.keys(catalog).filter((key) => !keys.has(key)).sort();
  return { code, findings: { missing, empty, obsolete, placeholderMismatch, paragraphMismatch } };
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ sourceKeys: keys.size, locales: summary }, null, 2));
} else {
  console.log(`${keys.size} extracted source keys`);
  for (const { code, findings } of summary) {
    console.log(`${code}  ${Object.entries(findings).map(([kind, entries]) => `${kind}=${entries.length}`).join("  ")}`);
  }
}
