// ── Offline translation pipeline ─────────────────────────────────────────────
// Turns the extracted English source strings (src/content/i18n/_strings.json,
// produced by `npm run i18n:extract`) into per-locale translation catalogs
// (src/content/i18n/<code>.json) that the build reads.
//
// This script runs OFFLINE — never during `npm run build`. It is the only place
// a translation model is invoked, so the build itself stays pure, deterministic,
// and byte-stable, and the strict site CSP (connect-src 'none') is never an
// issue: no translation ever happens in the browser.
//
// Default engine is a local Ollama model (free, private, no API key). The
// provider is a single function, so swapping in a hosted API is a one-spot
// change. Catalogs are merged: a re-run only translates keys that are missing
// (or all of them with --force), so progress is incremental and resumable.
//
// Usage (local Ollama, the default):
//   node scripts/i18n_translate.mjs --locale es
//   node scripts/i18n_translate.mjs --all
//   node scripts/i18n_translate.mjs --locale zh --model qwen2.5:3b --limit 50
//   node scripts/i18n_translate.mjs --locale de --force
//
// Usage (hosted OpenAI-compatible API — see docs/i18n.md):
//   I18N_PROVIDER=openai I18N_API_KEY=sk-... I18N_API_MODEL=gpt-4o-mini \
//     node scripts/i18n_translate.mjs --all
//   # OpenRouter example:
//   I18N_PROVIDER=openai I18N_API_BASE=https://openrouter.ai/api/v1 \
//     I18N_API_KEY=$OPENROUTER_KEY I18N_API_MODEL=anthropic/claude-3.5-sonnet \
//     node scripts/i18n_translate.mjs --all
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const I18N_DIR = path.join(ROOT, "src", "content", "i18n");
const STRINGS_FILE = path.join(I18N_DIR, "_strings.json");
const LOCALES = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "i18n", "locales.json"), "utf8"));

// ── Provider selection ───────────────────────────────────────────────────────
// I18N_PROVIDER picks the translation backend:
//   "ollama" (default) — local model via Ollama. Free, private, no key.
//   "openai"           — any OpenAI-compatible /chat/completions endpoint
//                        (OpenAI, OpenRouter, Together, a local vLLM, …). Set
//                        I18N_API_BASE, I18N_API_KEY, I18N_API_MODEL.
// Both backends share the same prompt and output cleanup, so swapping providers
// never changes catalog semantics. See docs/i18n.md for the hosted-API recipe.
const PROVIDER = process.env.I18N_PROVIDER || "ollama";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const API_BASE = process.env.I18N_API_BASE || "https://api.openai.com/v1";
const API_KEY = process.env.I18N_API_KEY || "";
const API_MODEL = process.env.I18N_API_MODEL || "gpt-4o-mini";

// Per-locale default Ollama model. qwen2.5 is notably stronger on CJK scripts;
// gemma3 is a solid multilingual generalist for everything else. Override with
// --model. For higher quality, pull a larger multilingual model (e.g.
// `ollama pull aya-expanse:8b` or `gemma3:12b`) and pass --model.
const DEFAULT_MODEL_BY_LOCALE = {
  zh: "qwen2.5:3b",
  ja: "qwen2.5:3b",
  ko: "qwen2.5:3b",
  default: "gemma3:4b",
};

// Proper nouns / brand terms that must survive translation verbatim.
const KEEP_VERBATIM = [
  "Active Inference Institute",
  "Active Inference",
  "Act. Infer. Serve.",
  "InstituteOS",
  "EduActive",
  "ReInference",
  "Discord",
  "GitHub",
  "YouTube",
  "AII",
];

function parseArgs(argv) {
  const args = { locales: [], model: null, limit: Infinity, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") {
      args.locales = LOCALES.locales.filter((l) => l.code !== LOCALES.defaultLocale).map((l) => l.code);
    } else if (arg === "--locale") {
      args.locales.push(argv[++i]);
    } else if (arg === "--model") {
      args.model = argv[++i];
    } else if (arg === "--limit") {
      args.limit = Number(argv[++i]);
    } else if (arg === "--force") {
      args.force = true;
    }
  }
  return args;
}

function modelFor(code, override) {
  if (override) {
    return override;
  }
  if (PROVIDER === "openai") {
    return API_MODEL;
  }
  return DEFAULT_MODEL_BY_LOCALE[code] || DEFAULT_MODEL_BY_LOCALE.default;
}

function readCatalog(code) {
  const file = path.join(I18N_DIR, `${code}.json`);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function writeCatalog(code, catalog) {
  // Sorted keys + trailing newline → stable diffs and byte-stable output.
  const sorted = {};
  for (const key of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = catalog[key];
  }
  fs.mkdirSync(I18N_DIR, { recursive: true });
  fs.writeFileSync(path.join(I18N_DIR, `${code}.json`), `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function systemPrompt(languageName) {
  const keep = KEEP_VERBATIM.map((term) => `"${term}"`).join(", ");
  // The input is delimiter-wrapped in «guillemets» so instruct/chat models treat
  // it as text to translate, not a topic/question to answer — this stops verbose
  // models (e.g. aya-expanse) from expanding a short label into an essay.
  return `You are a translation engine. The user message contains one piece of English UI text wrapped in «guillemets». Translate ONLY that text into ${languageName}.
Output just the translation on a single line. Do NOT answer, explain, expand, summarize, or continue the text; do NOT add markdown, bold, quotes, guillemets, or commentary.
Keep these terms exactly as written (do not translate): ${keep}.
Keep placeholder tokens like {n}, {title}, {count} unchanged.
Match the length and register of the source — a short label stays a short label.`;
}

// Wrap the source string in guillemets to mark it as text-to-translate.
function wrapInput(text) {
  return `«${text}»`;
}

// Strip the prompt-echo leakage small local models emit (a label like
// "English:"/"<Language>:" and a hallucinated continuation). EVERY translatable
// source string is a single line (verified: _strings.json has none with a
// newline), so the translation must be single-line too — cutting at the first
// line break reliably keeps only the translation and drops any trailing leak,
// regardless of how the model separated it (\n, \xa0\n, \n \n, …).
export function cleanTranslation(raw, languageName) {
  let text = String(raw || "");
  const brk = text.search(/[\r\n]/);
  if (brk !== -1) {
    text = text.slice(0, brk);
  }
  for (const marker of ["English:", `${languageName}:`, "Translation:"]) {
    if (text.startsWith(marker)) {
      text = text.slice(marker.length);
    }
  }
  // Strip wrapping delimiters/markdown the model may echo around the answer:
  // guillemets «», CJK brackets 「」『』, smart/ASCII quotes, bold/italic/code
  // markers, and stray heading hashes — at both edges only.
  const EDGE = "\\s«»‹›「」『』“”‘’\"'*_`#";
  const edgeRe = new RegExp(`^[${EDGE}]+|[${EDGE}]+$`, "gu");
  return text.replace(edgeRe, "").trim();
}

async function ollamaTranslate(text, languageName, model) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt(languageName) },
        { role: "user", content: wrapInput(text) },
      ],
      stream: false,
      options: { temperature: 0, top_p: 0.9, num_predict: 512 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return cleanTranslation(data.message?.content ?? "", languageName);
}

// Hosted, OpenAI-compatible /chat/completions backend. Works unchanged against
// OpenAI, OpenRouter, Together, Groq, a local vLLM, etc. — only I18N_API_BASE /
// I18N_API_KEY / I18N_API_MODEL differ. Same prompt + cleanup as Ollama.
async function openaiTranslate(text, languageName, model) {
  if (!API_KEY) {
    throw new Error("I18N_API_KEY is not set (required for the openai provider)");
  }
  const response = await fetch(`${API_BASE.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt(languageName) },
        { role: "user", content: wrapInput(text) },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return cleanTranslation(data.choices?.[0]?.message?.content ?? "", languageName);
}

// Single dispatch point — add a provider here and it is usable everywhere.
async function translateString(text, languageName, model) {
  if (PROVIDER === "openai") {
    return openaiTranslate(text, languageName, model);
  }
  return ollamaTranslate(text, languageName, model);
}

async function translateLocale(code, sources, opts) {
  const meta = LOCALES.locales.find((l) => l.code === code);
  if (!meta) {
    console.error(`Unknown locale: ${code}`);
    return;
  }
  const model = modelFor(code, opts.model);
  const catalog = opts.force ? {} : readCatalog(code);
  const todo = sources.filter((text) => opts.force || !(text in catalog)).slice(0, opts.limit);
  console.log(`\n[${code}] ${meta.name} via ${PROVIDER}:${model} — ${todo.length} to translate (${Object.keys(catalog).length} cached)`);
  let done = 0;
  for (const text of todo) {
    try {
      const translated = await translateString(text, meta.name, model);
      catalog[text] = translated && translated.trim() ? translated : text;
    } catch (error) {
      console.error(`  ! "${text.slice(0, 50)}…" -> ${error.message}`);
      catalog[text] = text; // graceful: fall back to English for this key
    }
    done += 1;
    if (done % 25 === 0) {
      writeCatalog(code, catalog); // checkpoint so progress survives a crash
      console.log(`  …${done}/${todo.length}`);
    }
  }
  writeCatalog(code, catalog);
  console.log(`[${code}] done — catalog now has ${Object.keys(catalog).length} entries`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.locales.length) {
    console.error("Specify --locale <code> (repeatable) or --all. Optional: --model <name> --limit <n> --force");
    process.exit(1);
  }
  if (!fs.existsSync(STRINGS_FILE)) {
    console.error(`Missing ${path.relative(ROOT, STRINGS_FILE)} — run \`npm run i18n:extract\` first.`);
    process.exit(1);
  }
  const sources = JSON.parse(fs.readFileSync(STRINGS_FILE, "utf8"));
  console.log(`Loaded ${sources.length} source strings; target locales: ${opts.locales.join(", ")}`);
  for (const code of opts.locales) {
    await translateLocale(code, sources, opts);
  }
  console.log("\nDone. Rebuild with `npm run build` to render the translated pages.");
}

// Run only when invoked as a CLI, so the module stays importable for tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
