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
  maskProtectedTerms,
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
