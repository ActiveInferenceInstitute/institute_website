// ── Terminology QA for the committed translation catalogs ────────────────────
// Sweeps src/content/i18n/<code>.json for glossary violations: catalog entries
// whose English source contains a protected term but whose translation
// mistranslates or loses it. Closes the deferred "terminology QA pass" backlog
// item (TODO.md) for the machine-translated catalogs.
//
// Two policies, driven by how scripts/i18n_translate.mjs treats the term:
//
//   verbatim   — brand/program names from KEEP_VERBATIM (InstituteOS,
//                "Research Fellows", Discord, …). These must survive
//                translation verbatim; any translated rendering is a finding.
//
//   recognized — terms of art with established per-locale renderings
//                ("Active Inference" → es "Inferencia Activa"). A recognized
//                rendering is reported as policy-visible but NOT auto-fixed:
//                grammatical repair is not provably correct without
//                re-translation, and the volume is a policy decision. A value
//                with NEITHER the English term NOR a recognized rendering has
//                lost the term — an "omitted" finding, the real corruption
//                class this sweep exists to catch (e.g. ja garble
//                "アクティブインフェリエンス", ko "활성 인퍼전", es
//                "razonamiento activo" for "active inference").
//
// "Markov Blanket" is QA-only (not added to KEEP_VERBATIM): every locale's
// scientific literature renders the term with the proper name retained
// ("manto de Markov", "马尔可夫毯"), so forcing verbatim English via masking
// would be wrong; the QA check instead requires the Markov root.
//
// Entries whose value equals their English key are skipped: that is the
// documented missing-key fallback, not a mistranslation.
//
// Usage:
//   node scripts/i18n_check_terminology.mjs                    # report all locales
//   node scripts/i18n_check_terminology.mjs --locale es --locale ja
//   node scripts/i18n_check_terminology.mjs --fix              # re-translate findings (Ollama/openai)
//   node scripts/i18n_check_terminology.mjs --fix --limit 50 --locale ja
//   node scripts/i18n_check_terminology.mjs --json             # machine-readable report
//
// --fix re-translates flagged entries through the existing offline pipeline
// (scripts/i18n_translate.mjs, whose protected-term masking keeps glossary
// terms verbatim), replaces the value only when the candidate passes the same
// glossary check, and is incremental/resumable: fixed entries are no longer
// flagged, so a re-run continues where the last one stopped.
//
// Exit status: 0 when no findings remain, 1 when findings were reported (so a
// future `npm run check` arm can gate on it directly).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { KEEP_VERBATIM, isDegenerate, mapWithConcurrency, modelFor, translateString } from "./i18n_translate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const I18N_DIR = path.join(ROOT, "src", "content", "i18n");
const LOCALES = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", "locales.json"), "utf8"));

// ── Established per-locale renderings of the concept terms ──────────────────
// Derived from the catalogs themselves (containment counts across all 11
// locales, 2026-09 terminology sweep); a rendering listed here is one the
// machine translator already uses in hundreds of entries. Matched
// case-insensitively against the translated value.
export const RECOGNIZED = {
  "Active Inference": {
    es: "inferencia activa",
    fr: "inf[ée]rence active",
    de: "inferenz",
    pt: "infer[êe]ncia ativa",
    it: "inferenza attiva",
    ru: "инференци|(активн[\\s\\S]{0,20}вывод|вывод[\\s\\S]{0,20}активн)",
    zh: "[积极主动動靜]推[理论斷論]",
    ja: "インファレンス|インフェレンス",
    ko: "인퍼런스|활성 추론",
    hi: "फे?रेंस|सक्रिय अनुमान",
    ar: "استدلال[\\s\\W]*ال?نشط|نشط[\\s\\W]*ال?استدلال",
  },
  "Free Energy Principle": {
    es: "energ[íi]a libre",
    fr: "[ée]nergie libre",
    de: "freie[rmnsz]?n?[\\s-]*energie|energie-prinzip|energy-prinzip|free.?energy",
    pt: "energia livre|livre[- ]energia",
    it: "energia libera|libera energia",
    ru: "свободн\\S*\\s+энерг",
    zh: "自由能",
    ja: "自由エネルギー|フリーエネルギー|エネルギー原理",
    ko: "자유\\s*에너지",
    hi: "ऊर्जा",
    ar: "طاقة[\\s\\W]*ال?حرة",
  },
  "Markov Blanket": {
    es: "markov",
    fr: "markov",
    de: "markov",
    pt: "markov",
    it: "markov",
    ru: "марков",
    zh: "马尔可夫",
    ja: "マルコフ",
    ko: "마르코프|마코프",
    hi: "मार्कोव",
    ar: "ماركوف",
  },
};

const CONCEPT_TERMS = new Set(Object.keys(RECOGNIZED));

// The QA glossary: KEEP_VERBATIM (the repo's own protected-term source) plus
// "Markov Blanket". "Research Fellows" is dropped because the singular entry
// matches the plural too and would double-count every entry.
export const GLOSSARY = [...KEEP_VERBATIM, "Markov Blanket"]
  .filter((term) => term !== "Research Fellows")
  .map((term) => ({
    term,
    policy: CONCEPT_TERMS.has(term) ? "recognized" : "verbatim",
    recognized: RECOGNIZED[term] || null,
  }));

// One pass over a catalog: per-term stats plus the flattened findings list.
// An entry (key, value) is scanned once per glossary term it contains, so an
// entry can yield findings for several terms (e.g. a key with "Applied Active
// Inference Symposium" can flag all three of the institute/symposium/term).
// A term whose entry is flagged under a longer glossary term is still counted
// for its own stats; --fix dedupes by key.
export function scanCatalog(catalog, localeCode, glossary = GLOSSARY) {
  const findings = [];
  const stats = Object.fromEntries(glossary.map((g) => [g.term, { entries: 0, verbatim: 0, recognized: 0, omitted: 0, missing: 0 }]));
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== "string" || !value.trim() || value === key) {
      continue; // non-string, provably dead, or the English fallback itself
    }
    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();
    for (const entry of glossary) {
      const termLower = entry.term.toLowerCase();
      if (!keyLower.includes(termLower)) {
        continue;
      }
      const s = stats[entry.term];
      s.entries += 1;
      if (valueLower.includes(termLower)) {
        s.verbatim += 1;
        continue;
      }
      if (entry.policy === "recognized") {
        const pattern = entry.recognized?.[localeCode];
        if (pattern && new RegExp(pattern, "iu").test(value)) {
          s.recognized += 1;
          continue;
        }
        s.omitted += 1;
        findings.push({ term: entry.term, key, value, kind: "omitted" });
      } else {
        s.missing += 1;
        findings.push({ term: entry.term, key, value, kind: "verbatim-missing" });
      }
    }
  }
  return { findings, stats };
}

// A re-translated candidate may replace an entry only if it passes the same
// glossary check (and is a real translation, verified by the caller).
export function entryPasses(key, value, localeCode, glossary = GLOSSARY) {
  return scanCatalog({ [key]: value }, localeCode, glossary).findings.length === 0;
}

function parseArgs(argv) {
  const args = { locales: [], model: null, limit: Infinity, fix: false, json: false, verbose: false, concurrency: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") {
      args.locales = LOCALES.locales.filter((l) => l.code !== LOCALES.defaultLocale).map((l) => l.code);
    } else if (arg === "--locale") {
      args.locales.push(argv[++i]);
    } else if (arg === "--model") {
      args.model = argv[++i];
    } else if (arg === "--limit") {
      args.limit = Number(argv[++i]) || Infinity;
    } else if (arg === "--concurrency") {
      args.concurrency = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === "--fix") {
      args.fix = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--verbose") {
      args.verbose = true;
    }
  }
  if (!args.locales.length) {
    args.locales = LOCALES.locales.filter((l) => l.code !== LOCALES.defaultLocale).map((l) => l.code);
  }
  return args;
}

function readCatalog(code) {
  const file = path.join(I18N_DIR, `${code}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeCatalog(code, catalog) {
  // Sorted keys + trailing newline — same byte-stable shape as
  // scripts/i18n_translate.mjs.
  const sorted = {};
  for (const key of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = catalog[key];
  }
  fs.writeFileSync(path.join(I18N_DIR, `${code}.json`), `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function summarize(stats) {
  return Object.fromEntries(
    Object.entries(stats).map(([term, s]) => [term, { entries: s.entries, verbatim: s.verbatim, recognized: s.recognized, omitted: s.omitted, missing: s.missing }]),
  );
}

async function fixLocale(code, catalog, findings, opts) {
  const meta = LOCALES.locales.find((l) => l.code === code);
  const model = modelFor(code, opts.model);
  // One entry may carry findings for several terms; fixing it once resolves all.
  const todo = [...new Map(findings.map((f) => [f.key, f])).keys()].slice(0, opts.limit);
  console.log(`\n[${code}] fixing ${todo.length} entries via ${model} (findings: ${findings.length})`);
  let done = 0;
  let fixed = 0;
  const results = await mapWithConcurrency(todo, opts.concurrency, async (key) => {
    try {
      const candidate = await translateString(key, meta.name, model);
      if (
        candidate &&
        candidate.trim() &&
        candidate !== key &&
        !isDegenerate(candidate, key) &&
        entryPasses(key, candidate, code)
      ) {
        catalog[key] = candidate;
        fixed += 1;
        return true;
      }
      return false;
    } catch (error) {
      console.error(`  ! ${code}: "${key.slice(0, 50)}…" -> ${error.message}`);
      return false;
    } finally {
      done += 1;
      if (done % 25 === 0) {
        console.log(`  …${done}/${todo.length} (${fixed} fixed)`);
      }
    }
  });
  const unresolved = todo.filter((_, i) => !results[i]);
  if (fixed > 0) {
    writeCatalog(code, catalog);
  }
  console.log(`[${code}] fixed ${fixed}, unresolved ${unresolved.length}`);
  return { fixed, unresolved };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const report = { scanned: {}, fixed: {} };
  let anyFindings = false;
  for (const code of opts.locales) {
    const catalog = readCatalog(code);
    const entries = Object.keys(catalog).length;
    const { findings, stats } = scanCatalog(catalog, code);
    anyFindings = anyFindings || findings.length > 0;
    const unique = new Set(findings.map((f) => f.key)).size;
    report.scanned[code] = { entries, findings: findings.length, uniqueEntries: unique, byTerm: summarize(stats) };
    if (opts.json) {
      continue;
    }
    const omitted = findings.filter((f) => f.kind === "omitted").length;
    const missing = findings.length - omitted;
    console.log(`[${code}] ${entries} entries — findings ${findings.length} across ${unique} entries (omitted ${omitted}, verbatim-missing ${missing})`);
    for (const [term, s] of Object.entries(stats)) {
      if (s.omitted || s.missing) {
        console.log(`    ${term}: entries ${s.entries} — verbatim ${s.verbatim}, recognized-rendering ${s.recognized}, omitted ${s.omitted}, verbatim-missing ${s.missing}`);
      }
    }
    for (const f of findings.slice(0, 3)) {
      console.log(`    e.g. [${f.kind}] ${f.key.slice(0, 70).replace(/\n/g, " ")}`);
      console.log(`         -> ${f.value.slice(0, 90).replace(/\n/g, " ")}`);
    }
    if (opts.verbose) {
      for (const f of findings) {
        console.log(`    [${f.kind}] ${f.term} | ${JSON.stringify(f.key)} -> ${JSON.stringify(f.value)}`);
      }
    }
    if (opts.fix && findings.length) {
      report.fixed[code] = await fixLocale(code, catalog, findings, opts);
      const after = scanCatalog(readCatalog(code), code).findings.length;
      report.scanned[code].findingsAfterFix = after;
      console.log(`[${code}] findings after fix: ${after}`);
    }
  }
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  }
  process.exitCode = anyFindings ? 1 : 0;
}

// Run only when invoked as a CLI, so the module stays importable for tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
