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
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("strict CLI rejects real HTTP failures and truncated/empty responses without saving English", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "i18n-strict-"));
  await fs.mkdir(path.join(root, "scripts"));
  await fs.mkdir(path.join(root, "src/content/i18n"), { recursive: true });
  await fs.mkdir(path.join(root, "src/i18n"));
  await fs.copyFile(new URL("./i18n_translate.mjs", import.meta.url), path.join(root, "scripts/i18n_translate.mjs"));
  await fs.copyFile(new URL("./i18n_check_terminology.mjs", import.meta.url), path.join(root, "scripts/i18n_check_terminology.mjs"));
  await fs.writeFile(path.join(root, "src/i18n/locales.json"), JSON.stringify({ defaultLocale: "en", locales: [{ code: "de", name: "German" }] }));
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify(["Page moved"]));
  const catalogPath = path.join(root, "src/content/i18n/de.json");
  const original = '{"Existing":"Vorhanden"}\n';
  await fs.writeFile(catalogPath, original);
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(root, "scripts/i18n_translate.mjs"), "--locale", "unknown", "--strict"]), error => error.code === 1 && error.stderr.includes("Unknown locale"));
  assert.equal(await fs.readFile(catalogPath, "utf8"), original);
  let response;
  const requests = [];
  const server = http.createServer((request, reply) => {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      const parsed = JSON.parse(body);
      requests.push(parsed);
      const message = parsed.messages[1].content;
      const result = response.segmentTranslations
        ? { done: true, done_reason: "stop", message: { content: response.segmentTranslations[message.slice(1, -1)] } }
        : response.failSecondSegment && message.includes("Second paragraph")
        ? { done: true, done_reason: "stop", message: { content: response.failSecondSegment === "repeat" ? "la".repeat(40) : "" } }
        : response.body;
      reply.writeHead(response.status, { "Content-Type": "application/json" });
      reply.end(JSON.stringify(result));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const env = { ...process.env, I18N_PROVIDER: "ollama", OLLAMA_URL: `http://127.0.0.1:${server.address().port}` };
  const execute = (extra = []) => promisify(execFile)(process.execPath, [path.join(root, "scripts/i18n_translate.mjs"), "--locale", "de", "--strict", ...extra], { env });
  for (const fixture of [
    { status: 503, body: { error: "unavailable" } },
    { status: 200, body: { done: true, done_reason: "length", message: { content: "Seite" } } },
    { status: 200, body: { done: true, done_reason: "stop", message: { content: "" } } },
    { status: 200, body: { done: true, done_reason: "stop", message: { content: "Page moved" } } },
    { status: 200, body: { done: true, done_reason: "stop", message: { content: "Page moved — translated" } } },
    { source: "Active Inference meeting.", status: 200, body: { done: true, done_reason: "stop", message: { content: "Treffen." } } },
    { source: "Active Inference Institute meeting.", status: 200, body: { done: true, done_reason: "stop", message: { content: "Treffen zur aktiven Inferenz." } } },
    { source: "{n} upcoming events", status: 200, body: { done: true, done_reason: "stop", message: { content: "Künftige Ereignisse" } } },
    { source: "Comment by email.", status: 200, body: { done: true, done_reason: "stop", message: { content: "Per E-Mail kommentieren {domain}" } } },
    { source: "Write to blanket@activeinference.institute with subject [WORKING GROUPS].", status: 200, body: { done: true, done_reason: "stop", message: { content: "Schreiben Sie an blanket@activeinference.institute mit dem Betreff [ARBEITSGRUPPEN]." } } },
    { source: "First paragraph.\n\nSecond paragraph.", failSecondSegment: true, status: 200, body: { done: true, done_reason: "stop", message: { content: "Erster Absatz." } } },
    { source: "First paragraph.\n\nSecond paragraph.", failSecondSegment: "repeat", status: 200, body: { done: true, done_reason: "stop", message: { content: "Erster Absatz." } } },
  ]) {
    await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify([fixture.source ?? "Page moved"]));
    response = fixture;
    await assert.rejects(execute(), error => error.code === 1);
    assert.equal(await fs.readFile(catalogPath, "utf8"), original);
  }
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify(["Page moved"]));
  response = { status: 200, body: { done: true, done_reason: "stop", message: { content: "Seite verschoben" } } };
  await execute();
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  assert.deepEqual(catalog, { Existing: "Vorhanden", "Page moved": "Seite verschoben" });
  const keysFile = path.join(root, "unknown-keys.json");
  await fs.writeFile(keysFile, JSON.stringify(["Unknown source"]));
  const saved = await fs.readFile(catalogPath, "utf8");
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(root, "scripts/i18n_translate.mjs"), "--locale", "de", "--strict", "--keys-file", keysFile], { env }), error => error.code === 1);
  assert.equal(await fs.readFile(catalogPath, "utf8"), saved);
  const multiline = "First paragraph.\n\nSecond paragraph.";
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify([multiline]));
  await fs.writeFile(catalogPath, JSON.stringify({ ...catalog, [multiline]: "Erster Absatz." }));
  await fs.writeFile(keysFile, JSON.stringify([multiline]));
  response = { status: 200, segmentTranslations: { "First paragraph.": "Erster Absatz.", "Second paragraph.": "Zweiter Absatz." } };
  await execute(["--retry-incomplete", "--keys-file", keysFile]);
  assert.deepEqual(JSON.parse(await fs.readFile(catalogPath, "utf8")), {
    Existing: "Vorhanden", "Page moved": "Seite verschoben", [multiline]: "Erster Absatz.\n\nZweiter Absatz.",
  });
  assert.ok(requests.every(request => request.options.num_predict === 2048));
  assert.ok(requests.some(request => request.messages[0].content.includes("Required placeholder sequence: {K0}")));
  const beforeForce = await fs.readFile(catalogPath, "utf8");
  for (const operation of ["--force", "--prune"]) {
    await assert.rejects(execute(["--keys-file", keysFile, operation]), error => error.code === 1);
    assert.equal(await fs.readFile(catalogPath, "utf8"), beforeForce);
  }
  const hostedEnv = { ...env, I18N_PROVIDER: "openai", I18N_API_BASE: env.OLLAMA_URL, I18N_API_KEY: "local-http-fixture" };
  const hosted = () => promisify(execFile)(process.execPath, [path.join(root, "scripts/i18n_translate.mjs"), "--locale", "de", "--strict"], { env: hostedEnv });
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify(["Current page"]));
  const beforeHosted = await fs.readFile(catalogPath, "utf8");
  response = { status: 200, body: { choices: [{ finish_reason: "length", message: { content: "Aktuelle" } }] } };
  await assert.rejects(hosted(), error => error.code === 1);
  assert.equal(await fs.readFile(catalogPath, "utf8"), beforeHosted);
  response = { status: 200, body: { choices: [{ finish_reason: "stop", message: { content: "Aktuelle Seite" } }] } };
  await hosted();
  assert.equal(JSON.parse(await fs.readFile(catalogPath, "utf8"))["Current page"], "Aktuelle Seite");
  assert.equal(requests.at(-1).max_tokens, 2048);
  const sentences = "First sentence.  Second sentence.";
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify([sentences]));
  response = { status: 200, segmentTranslations: { "First sentence.": "Erster Satz.", "Second sentence.": "Zweiter Satz." } };
  await execute();
  assert.equal(JSON.parse(await fs.readFile(catalogPath, "utf8"))[sentences], "Erster Satz.  Zweiter Satz.");
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify(["Active Inference meeting"]));
  response = { status: 200, body: { done: true, done_reason: "stop", message: { content: "Treffen zur aktiven Inferenz" } } };
  await execute();
  assert.equal(JSON.parse(await fs.readFile(catalogPath, "utf8"))["Active Inference meeting"], "Treffen zur aktiven Inferenz");
  await fs.writeFile(path.join(root, "src/content/i18n/_strings.json"), JSON.stringify(["GitHub"]));
  response = { status: 200, body: { done: true, done_reason: "stop", message: { content: "GitHub" } } };
  await execute();
  assert.equal(JSON.parse(await fs.readFile(catalogPath, "utf8"))["GitHub"], "GitHub");
});

import {
  cleanTranslation,
  hasMissingParagraphs,
  systemPrompt,
  collectTrLiterals,
  isDegenerate,
  isTransientStatus,
  mapWithConcurrency,
  maskProtectedTerms,
  pruneCatalog,
  unmaskProtectedTerms,
} from "./i18n_translate.mjs";

test("multiline translation preserves lists and paragraphs while labels still discard prompt echo", () => {
  const source = "- Attend the meeting.\n- Review the draft.\n\nMembership is open.";
  const translated = "- Nehmen Sie am Treffen teil.\n- Prüfen Sie den Entwurf.\n\nDie Mitgliedschaft ist offen.";
  assert.equal(cleanTranslation(translated, "German", source), translated);
  assert.equal(hasMissingParagraphs(source, translated), false);
  assert.equal(hasMissingParagraphs(source, "Nehmen Sie am Treffen teil."), true);
  assert.match(systemPrompt("German", source), /Preserve paragraph breaks, list structure/);
  assert.doesNotMatch(systemPrompt("German", source), /single line/);
  assert.match(systemPrompt("German", "Hello"), /single line/);
  assert.equal(cleanTranslation("Hallo\nEnglish: Hello", "German", "Hello"), "Hallo");
  assert.equal(cleanTranslation("**Jetzt.** Öffentliche Prüfung.", "German", "**Now.** Public review."), "**Jetzt.** Öffentliche Prüfung.");
});

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

test("pruneCatalog keeps legacy extras (keys outside the source set) — regression pin", () => {
  // The original prune dropped every key absent from _strings.json and deleted
  // live translations (incl. the runtime-lookup mt-notice keys) from all 11
  // locales. Legacy extras survive prune BY DESIGN.
  const sources = new Set(["Browse by topic", "Fellow since"]);
  const catalog = {
    "Browse by topic": "Tema navegación",
    "Fellow since": "Investigador desde",
    "This page was machine-translated from English.": "Diese Seite wurde maschinell aus dem Englischen übersetzt.",
    "View the English original.": "Englisches Original ansehen",
    "{n} strategy nodes in the public strategy map": "{n} nodos de estrategia",
  };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 0);
  assert.deepEqual(kept, catalog);
});

test("pruneCatalog drops only empty/whitespace-valued (provably dead) entries", () => {
  const sources = new Set(["Browse by topic"]);
  const catalog = {
    "Browse by topic": "Tema navegación",
    "Legacy extra": "Legado",
    "Empty value": "",
    "Whitespace value": "   ",
  };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 2);
  assert.deepEqual(kept, { "Browse by topic": "Tema navegación", "Legacy extra": "Legado" });
});

test("pruneCatalog is a no-op (returns the same catalog) when nothing is dead", () => {
  const sources = new Set(["Browse by topic"]);
  const catalog = { "Browse by topic": "Tema navegación" };
  const [kept, n] = pruneCatalog(catalog, sources);
  assert.equal(n, 0);
  assert.deepEqual(kept, catalog);
});

test("collectTrLiterals derives the runtime-lookup extras from tr() call sites", () => {
  // Verified against the real tree: the mt-notice keys are looked up ONLY on
  // non-default-locale passes, so the extractor never records them — but the
  // literal scan of src/ must still find them, or prune could not reason about
  // them at all.
  const lits = collectTrLiterals(new URL("../src/", import.meta.url).pathname);
  assert.ok(lits.has("This page was machine-translated from English."));
  assert.ok(lits.has("Navigation is machine-translated; the archived content remains in English."));
  assert.ok(lits.has("View the English original."));
  assert.ok(lits.size > 100, `expected the full renderer literal set, got ${lits.size}`);
});
