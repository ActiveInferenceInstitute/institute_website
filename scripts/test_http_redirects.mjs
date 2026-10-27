import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRedirectHandler } from "../src/http-redirects.mjs";

const entries = JSON.parse(readFileSync(new URL("../data/redirects.json", import.meta.url), "utf8"));
const redirect = createRedirectHandler(entries, "https://activeinference.institute/");

test("generated legacy mappings produce one permanent hop across host/scheme/slash variants", () => {
  for (const entry of entries) {
    for (const scheme of ["http", "https"]) {
      for (const host of ["activeinference.institute", "www.activeinference.institute"]) {
        for (const method of ["GET", "HEAD"]) {
          const paths = entry.from.endsWith(".html") ? [entry.from] : [entry.from, entry.from + "/", entry.from + ".html"];
          for (const path of paths) {
            const response = redirect(new Request(`${scheme}://${host}/${path}?ref=legacy`, { method }));
            assert.equal(response.status, 308, entry.from);
            assert.equal(response.headers.get("location"), `https://activeinference.institute/${entry.to}?ref=legacy`);
            assert.equal(redirect(new Request(response.headers.get("location"), { method })), null, "destination must not redirect again");
          }
        }
      }
    }
  }
});

test("unknown routes pass to the origin, shortlinks remain independent, and unsafe maps fail", () => {
  assert.equal(redirect(new Request("https://activeinference.institute/missing/")), null);
  assert.equal(redirect(new Request("https://donate.activeinference.institute/")), null);
  assert.equal(redirect(new Request("https://activeinference.institute/donate", { method: "POST" })), null);
  assert.equal(redirect(new Request("https://activeinference.institute/%invalid")), null);
  const hostOnly = redirect(new Request("http://www.activeinference.institute/missing/"));
  assert.equal(hostOnly.headers.get("location"), "https://activeinference.institute/missing/");
  for (const to of ["https://evil.example/", "../secret/", "//evil.example/", "current/?q=x"]) {
    assert.throws(() => createRedirectHandler([{ from: "old", to }], "https://activeinference.institute/"), TypeError);
  }
  assert.throws(() => createRedirectHandler([{ from: "one", to: "two/" }, { from: "two", to: "one/" }], "https://activeinference.institute/"), /loop or chain/);
});
