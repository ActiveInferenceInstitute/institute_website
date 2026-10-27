import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createAssetWorker } from "../src/edge-worker.mjs";

test("every generated legacy mapping takes one 308 hop across hosts, schemes, methods and slash variants", async () => {
  const entries = JSON.parse(await readFile(new URL("../data/redirects.json", import.meta.url)));
  const worker = createAssetWorker(entries, "https://activeinference.institute/");
  assert.ok(entries.length > 700, "The full generated mapping inventory must be exercised");
  for (const entry of entries) for (const scheme of ["http", "https"]) for (const host of ["activeinference.institute", "www.activeinference.institute"]) for (const method of ["GET", "HEAD"]) for (const slash of ["", "/"]) {
    const response = await worker.fetch(new Request(`${scheme}://${host}/${entry.from}${slash}?x=a%20b&x=%2F%26`, { method }), {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), `https://activeinference.institute/${entry.to}?x=a%20b&x=%2F%26`);
  }
});

test("real asset origin preserves unknown 404s and non-GET methods without a proxy loop", async () => {
  const root = resolve(new URL("../", import.meta.url).pathname);
  const server = createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const name = new URL(req.url, "http://localhost").pathname;
    const file = resolve(root, "." + name + (name.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try { const body = await readFile(file); res.writeHead(200); res.end(body); }
    catch (error) { if (error.code !== "ENOENT") { res.writeHead(500); res.end(); } else { res.writeHead(404); res.end("Not found"); } }
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const worker = createAssetWorker([{ from: "internship", to: "programs/internship/" }], "https://activeinference.institute/");
  const env = { ASSETS: { fetch(request) { const url = new URL(request.url); return fetch(`http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`, { method: request.method }); } } };
  try {
    const moved = await worker.fetch(new Request("https://activeinference.institute/internship/"), env);
    const actual = await worker.fetch(new Request(moved.headers.get("location")), env);
    assert.equal(actual.status, 200);
    assert.equal((await worker.fetch(new Request("https://activeinference.institute/not-a-real-control/"), env)).status, 404);
    assert.equal((await worker.fetch(new Request("https://activeinference.institute/internship/", { method: "POST" }), env)).status, 405);
    assert.equal((await worker.fetch(new Request("https://intern.activeinference.institute/"), env)).status, 404);
  } finally { await new Promise(done => server.close(done)); }
});
