// ── Unit tests for the offline translation pipeline's pure helpers ───────────
// Run: node --test scripts/test_i18n_translate.mjs  (or `npm run check:i18n`)
//
// These four functions decide what reaches a public page in ten languages, and
// each of them exists because a small local model failed in a specific way. The
// failures are cheap to re-introduce and expensive to notice — a mistranslated
// program name or a repetition loop looks like ordinary text in a diff of 3,400
// strings — so they are pinned here. Uses node:test, which ships with Node: the
// site build stays dependency-free.
import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanTranslation,
  isDegenerate,
  isTransientStatus,
  mapWithConcurrency,
  maskProtectedTerms,
  pruneCatalog,
  unmaskProtectedTerms,
} from "./i18n_translate.mjs";

test("protected terms round-trip through masking unchanged", () => {
  const source = "9 current Research Fellows at the Active Inference Institute with an ORCID";
  const { masked, restore } = maskProtectedTerms(source);
  assert.ok(!masked.includes("Research Fellows"), "term should be masked out of the request");
  assert.ok(!masked.includes("Active Inference Institute"));
  assert.equal(unmaskProtectedTerms(masked, restore), source);
});

test("the longest protected term wins over its own substring", () => {
  // "Active Inference" is a substring of "Active Inference Institute"; masking the
  // short one first would leave a mangled "{K0} Institute" behind.
  const { masked, restore } = maskProtectedTerms("The Active Inference Institute studies Active Inference.");
  assert.equal(unmaskProtectedTerms(masked, restore), "The Active Inference Institute studies Active Inference.");
  assert.ok(!masked.includes("Institute"), "the full term should be masked, not just its head");
});

test("masking is a no-op for text carrying no protected term", () => {
  const { masked, restore } = maskProtectedTerms("Browse by topic");
  assert.equal(masked, "Browse by topic");
  assert.deepEqual(restore, []);
});

test("unmasking tolerates the token spacing and casing models drift into", () => {
  const { restore } = maskProtectedTerms("Research Fellows");
  assert.equal(unmaskProtectedTerms("{k 0}", restore), "Research Fellows");
});

test("a repetition loop is rejected", () => {
  // The exact failure qwen2.5:3b produced for a one-sentence Japanese string.
  const loop = `これは${"tuute".repeat(40)}`;
  assert.equal(isDegenerate(loop, "Each fellow works on a defined scope of research."), true);
});

test("a translation far longer than its source is rejected", () => {
  assert.equal(isDegenerate("x".repeat(400), "Fellow since"), true);
});

test("empty output is rejected so the English source is kept", () => {
  assert.equal(isDegenerate("", "Fellow"), true);
  assert.equal(isDegenerate(null, "Fellow"), true);
});

test("an ordinary translation passes", () => {
  assert.equal(
    isDegenerate("Cada investigador trabaja en un alcance de investigación definido.", "Each fellow works on a defined scope of research."),
    false,
  );
  // Short labels legitimately grow when translated; the floor must not clip them.
  assert.equal(isDegenerate("Investigador desde", "Fellow since"), false);
  assert.equal(isDegenerate("研究員", "Fellow"), false);
});

test("prompt echo and wrapping delimiters are stripped", () => {
  assert.equal(cleanTranslation("Spanish: «Hola»", "Spanish"), "Hola");
  assert.equal(cleanTranslation("**Hola**", "Spanish"), "Hola");
  assert.equal(cleanTranslation("Hola\nand here is why…", "Spanish"), "Hola");
});

test("only load-shaped HTTP statuses are retried", () => {
  // Retrying a 401 wastes four backoffs and then reports a bad key as if the
  // provider were busy; retrying a 429 is the whole point.
  for (const status of [408, 409, 429, 500, 502, 503, 504]) {
    assert.equal(isTransientStatus(status), true, `${status} should be retried`);
  }
  for (const status of [200, 400, 401, 403, 404, 422]) {
    assert.equal(isTransientStatus(status), false, `${status} should fail fast`);
  }
});

test("bounded concurrency preserves input order", () => {
  // Results are written back to the catalog positionally, so an out-of-order
  // result would silently file a Spanish string under a German key.
  const items = Array.from({ length: 25 }, (_, i) => i);
  return mapWithConcurrency(items, 6, async (n) => {
    await new Promise((r) => setTimeout(r, (n % 5) * 2));
    return n * 2;
  }).then((out) => assert.deepEqual(out, items.map((n) => n * 2)));
});

test("concurrency never exceeds its limit", async () => {
  let active = 0;
  let peak = 0;
  await mapWithConcurrency(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 1));
    active -= 1;
  });
  assert.ok(peak <= 4, `peak concurrency was ${peak}, limit was 4`);
});

test("an empty work list is a no-op, not a hang", async () => {
  assert.deepEqual(await mapWithConcurrency([], 6, async () => "x"), []);
});

test("pruneCatalog drops only keys absent from the current source set", () => {
  const sources = new Set(["Browse by topic", "Fellow since"]);
  const catalog = {
    "Browse by topic": "Tema navegación",
    "Fellow since": "Investigador desde",
    "{n} strategy nodes in the public strategy map": "{n} nodos de estrategia",
  };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 1);
  assert.deepEqual(kept, { "Browse by topic": "Tema navegación", "Fellow since": "Investigador desde" });
});

test("pruneCatalog is a no-op (returns the same catalog) when nothing is stale", () => {
  const sources = new Set(["Browse by topic"]);
  const catalog = { "Browse by topic": "Tema navegación" };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 0);
  assert.deepEqual(kept, catalog);
});

test("pruneCatalog keeps current keys that merely LOOK stale (exact-match contract)", () => {
  // Keys are matched against the source set exactly; a key differing only by
  // punctuation IS stale (the extractor produced a new string), but a key that
  // contains a source string as a substring is NOT (it is a different entry).
  const sources = new Set(["Browse"]);
  const catalog = { "Browse": "Navegar", "Browse by topic": "Tema navegación" };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 1);
  assert.deepEqual(kept, { "Browse": "Navegar" });
});
