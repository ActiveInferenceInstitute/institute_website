// ── Unit tests for the terminology QA pass's pure helpers ────────────────────
// Run: node --test scripts/test_i18n_terminology.mjs
//
// The scan decides which catalog entries get flagged — and under --fix,
// rewritten — across eleven public catalogs, so the classification rules are
// pinned here: the recognized-rendering pass, the omission catch, the English
// fallback skip, and the case-insensitive verbatim match. Uses node:test, which
// ships with Node: the site build stays dependency-free.
import test from "node:test";
import assert from "node:assert/strict";

import { GLOSSARY, entryPasses, scanCatalog } from "./i18n_check_terminology.mjs";

test("a recognized native rendering is not a finding", () => {
  const { findings } = scanCatalog(
    { "Fundamentals of Active Inference": "Fundamentos de Inferencia Activa" },
    "es",
  );
  assert.equal(findings.length, 0);
});

test("a value that lost the term entirely is flagged as omitted", () => {
  const { findings, stats } = scanCatalog(
    { "Fundamentals of Active Inference": "Fundamentos del razonamiento activo" },
    "es",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "omitted");
  assert.equal(findings[0].term, "Active Inference");
  assert.equal(stats["Active Inference"].omitted, 1);
});

test("the recognized check is per-locale", () => {
  // The Spanish rendering must not satisfy the German locale: an es-style
  // rendering in a de catalog is still a lost term.
  const { findings } = scanCatalog(
    { "Fundamentals of Active Inference": "Grundlagen der Inferencia Activa" },
    "de",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "omitted");
});

test("an established localized rendering of Markov Blanket passes", () => {
  const { findings } = scanCatalog(
    { "Markov Blanket": "Manto de Markov" },
    "es",
  );
  assert.equal(findings.length, 0);
});

test("a Markov Blanket value that drops the proper name is flagged", () => {
  const { findings } = scanCatalog(
    { "Markov Blanket": "la cobertura estocástica del agente" },
    "es",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "omitted");
});

test("Traditional-Chinese rendering of the term is recognized", () => {
  const { findings } = scanCatalog(
    { "Active Inference and the Free Energy Principle": "主動推理與自由能原理" },
    "zh",
  );
  assert.equal(findings.length, 0);
});

test("an English fallback (value equals key) is skipped, not flagged", () => {
  const { findings } = scanCatalog({ "Research Fellows": "Research Fellows" }, "es");
  assert.equal(findings.length, 0);
});

test("a verbatim-policy term rendered natively is flagged", () => {
  const { findings, stats } = scanCatalog(
    { "Research Fellows": "Investigadores de Investigación" },
    "es",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "verbatim-missing");
  assert.equal(findings[0].term, "Research Fellow");
  assert.equal(stats["Research Fellow"].missing, 1);
});

test("verbatim matching is case-insensitive", () => {
  const { findings } = scanCatalog(
    { "Join our Discord": "Únete a nuestro discord" },
    "es",
  );
  assert.equal(findings.length, 0);
});

test("keys without a glossary term are ignored", () => {
  const { findings } = scanCatalog({ "Weekly meeting notes": "Notas de la reunión semanal" }, "es");
  assert.equal(findings.length, 0);
});

test("non-string and empty values are ignored", () => {
  const { findings } = scanCatalog({ "Active Inference": null, "Research Fellow": "" }, "es");
  assert.equal(findings.length, 0);
});

test("one entry can carry findings for several glossary terms", () => {
  const { findings } = scanCatalog(
    { "Applied Active Inference Symposium": "Simposio Aplicado de Razonamiento" },
    "es",
  );
  const terms = new Set(findings.map((f) => f.term));
  assert.ok(terms.has("Applied Active Inference Symposium"));
  assert.ok(terms.has("Active Inference"));
});

test("entryPasses accepts a term-preserving re-translation and rejects a lossy one", () => {
  const key = "Fundamentals of Active Inference";
  assert.equal(entryPasses(key, "Fundamentos de la Inferencia Activa", "es"), true);
  assert.equal(entryPasses(key, "Fundamentos del razonamiento activo", "es"), false);
});

test("the glossary derives from KEEP_VERBATIM without plural double-counting", () => {
  const terms = GLOSSARY.map((g) => g.term);
  assert.ok(terms.includes("Active Inference"));
  assert.ok(terms.includes("Markov Blanket"));
  assert.ok(terms.includes("Active Inference Institute"));
  assert.ok(!terms.includes("Research Fellows"), "singular entry already matches the plural");
  for (const g of GLOSSARY) {
    if (g.policy === "recognized") {
      assert.ok(g.recognized && g.recognized.es, `${g.term} needs recognized renderings`);
    }
  }
});
