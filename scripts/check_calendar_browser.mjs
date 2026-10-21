import assert from "node:assert/strict";
import { runBrowserProcess } from "./browser_process.mjs";
import { readCalendarReceipt } from "./calendar_cdp.mjs";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const chrome = process.env.CHROME_BIN;
assert.ok(chrome, "Set CHROME_BIN to a Chrome/Chromium executable before running check:browser");
const { defaultLocale, locales } = JSON.parse(await readFile(join(root, "src/i18n/locales.json"), "utf8"));
const profile = await mkdtemp(join(tmpdir(), "website-calendar-browser-"));
const probe = await readFile(join(root, "scripts/calendar_browser_probe.js"));
const currentScript = await readFile(join(root, "assets/js/site.js"), "utf8");
const fixedCount = 'calendarCount.textContent = countMsg(calendarCount, "data-msg-count-events", "Events shown: {n}", visible);';
assert.ok(currentScript.includes(fixedCount), "Negative control must target the actual calendar update");
const brokenScript = currentScript.replace(fixedCount,
  'calendarCount.textContent = countMsg(calendarCount, "data-msg-count-events", "{n} {label} shown", visible, visible === 1 ? scope : `${scope}s`);');
let negativeControl = false;
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/__calendar_probe.js") {
      response.writeHead(200, { "Content-Type": "application/javascript" });
      response.end(probe);
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = resolve(root, relative + (url.pathname.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    let body = await readFile(file);
    if (file.endsWith("calendar/index.html")) {
      body = body.toString().replace("</head>", '<script src="/__calendar_probe.js"></script></head>');
    } else if (file === join(root, "assets/js/site.js") && negativeControl) {
      body = brokenScript;
    }
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(String(error.message));
  }
});
await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
const origin = `http://127.0.0.1:${server.address().port}`;
const receipts = [];
async function browse(path) {
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    `--user-data-dir=${profile}`, "--remote-debugging-pipe", "--no-startup-window"];
  if (process.env.CHROME_NO_SANDBOX === "1") args.unshift("--no-sandbox");
  const processResult = await runBrowserProcess(chrome, args, 45000,
    (child) => readCalendarReceipt(child, origin + path));
  const receipt = processResult.result;
  assert.ok(["passed", "failed"].includes(receipt?.status), `Browser produced no calendar receipt at ${path}`);
  return { path, status: receipt.status, exitCode: processResult.exitCode, killed: processResult.killed,
    elapsedMs: processResult.elapsedMs, ...JSON.parse(decodeURIComponent(receipt.encoded)) };
}
try {
  negativeControl = true;
  const broken = await browse("/calendar/");
  receipts.push(broken);
  assert.equal(broken.status, "failed", "Original runtime error must fail the browser regression check");
  assert.ok(broken.errors?.some((error) => error.includes("scope is not defined")), JSON.stringify(broken));
  negativeControl = false;
  for (const { code } of locales) {
    const path = code === defaultLocale ? "/calendar/" : `/${code}/calendar/`;
    const receipt = await browse(path);
    receipts.push(receipt);
    assert.equal(receipt.status, "passed", JSON.stringify(receipt));
    assert.equal(receipt.locale, code);
    console.log(`${code}: ${receipt.checks.join(", ")}`);
  }
  console.log("Calendar browser regression passed in all locales; original ReferenceError rejected.");
} finally {
  await writeFile(join(profile, "receipts.json"), JSON.stringify(receipts, null, 2) + "\n");
  console.log(`Browser receipts: ${join(profile, "receipts.json")}`);
  await new Promise((accept, reject) => server.close((error) => error ? reject(error) : accept()));
}
