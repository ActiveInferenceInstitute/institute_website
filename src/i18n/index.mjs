// ── Internationalization core ────────────────────────────────────────────────
// Build-time i18n for the static site. There is NO runtime translation: the CSP
// forbids the browser from making any network request (connect-src 'none'), so
// every language is fully pre-rendered at build time. This module owns three
// things:
//   1. the locale registry (src/i18n/locales.json),
//   2. the active-locale context the build sets once per locale pass, and
//   3. tr(): the translate-a-source-string accessor render code calls.
//
// Translation catalogs are committed JSON (src/content/i18n/<code>.json), keyed
// by the exact English source string. They are produced offline by
// scripts/i18n_translate.mjs (which may call a local Ollama model or any API)
// and reviewed in PRs — so the build itself stays pure, deterministic, and
// byte-stable. Missing keys fall back to English, so a partially-translated
// locale never produces a broken page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _dir = path.dirname(fileURLToPath(import.meta.url));
const _config = JSON.parse(fs.readFileSync(path.join(_dir, "locales.json"), "utf8"));

export const DEFAULT_LOCALE = _config.defaultLocale;
export const LOCALES = _config.locales;
export const LOCALE_BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]));
export const NON_DEFAULT_LOCALES = LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE);

export function localeMeta(code) {
  return LOCALE_BY_CODE.get(code) || LOCALE_BY_CODE.get(DEFAULT_LOCALE);
}

export function isDefaultLocale(code) {
  return code === DEFAULT_LOCALE;
}

// ── Catalog loading (lazy, cached per locale) ────────────────────────────────
const catalogDir = path.join(_dir, "..", "content", "i18n");
const _catalogCache = new Map();

function catalogFor(code) {
  if (_catalogCache.has(code)) {
    return _catalogCache.get(code);
  }
  let catalog = {};
  const file = path.join(catalogDir, `${code}.json`);
  if (fs.existsSync(file)) {
    try {
      catalog = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      catalog = {};
    }
  }
  _catalogCache.set(code, catalog);
  return catalog;
}

// ── Active-locale context (set once per build locale pass) ────────────────────
let _active = DEFAULT_LOCALE;

export function setActiveLocale(code) {
  _active = LOCALE_BY_CODE.has(code) ? code : DEFAULT_LOCALE;
}

export function activeLocale() {
  return _active;
}

// ── Extraction mode ──────────────────────────────────────────────────────────
// When I18N_EXTRACT is set, every tr() source string is recorded so the
// translate pipeline knows the exact set of strings that need translating.
const _extract = process.env.I18N_EXTRACT === "1";
const _extracted = new Set();

export function extractedStrings() {
  return [..._extracted];
}

export function writeExtracted(file) {
  const sorted = [..._extracted].sort((a, b) => a.localeCompare(b));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  return sorted.length;
}

// ── tr(): translate a user-visible English source string ─────────────────────
// Returns the active-locale translation, falling back to the source text. Only
// non-empty strings are translatable; anything else passes through untouched so
// callers can wrap freely. In extract mode the source string is recorded.
export function tr(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return text;
  }
  if (_extract) {
    _extracted.add(text);
  }
  if (_active === DEFAULT_LOCALE) {
    return text;
  }
  const catalog = catalogFor(_active);
  const hit = catalog[text];
  return typeof hit === "string" && hit.trim() !== "" ? hit : text;
}
