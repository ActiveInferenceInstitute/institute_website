import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runBrowserProcess } from "./browser_process.mjs";
import { readCalendarReceipt } from "./calendar_cdp.mjs";

test("browser runner accepts normal completion and preserves diagnostics", async () => {
  const result = await runBrowserProcess(process.execPath, ["-e", 'process.stdout.write("complete"); process.stderr.write("diagnostic");']);
  assert.equal(result.stdout, "complete");
  assert.equal(result.stderr, "diagnostic");
  assert.equal(result.exitCode, 0);
  assert.equal(result.killed, false);
  assert.ok(result.elapsedMs >= 0);
});

test("browser runner rejects a real nonzero exit with its stderr", async () => {
  await assert.rejects(runBrowserProcess(process.execPath, ["-e", 'process.stderr.write("failure details"); process.exit(7);']),
    /exit=7.*failure details/);
});

test("browser runner rejects timeout even when SIGTERM handler exits zero", async () => {
  await assert.rejects(runBrowserProcess(process.execPath, ["-e",
    'process.on("SIGTERM", () => process.exit(0)); process.stdout.write("ready"); setInterval(() => {}, 1000);'], 2000),
    /killed=true, exit=0.*stdout=ready/);
});

test("browser runner rejects an unavailable executable", async () => {
  await assert.rejects(runBrowserProcess(join(tmpdir(), `unavailable-browser-${process.pid}-${Date.now()}`), []),
    { code: "ENOENT" });
});

test("browser runner rejects a real signal termination", async () => {
  await assert.rejects(runBrowserProcess(process.execPath, ["-e", 'process.kill(process.pid, "SIGTERM");']),
    /killed=false, exit=null, signal=SIGTERM/);
});

test("browser driver can finish a real subprocess and return its result", async () => {
  const result = await runBrowserProcess(process.execPath, ["-e",
    'require("node:fs").createReadStream(null, {fd:3}).once("data", () => process.exit(0));'], 45000,
    async (child) => { child.stdio[3].write("close"); return { checked: true }; });
  assert.deepEqual(result.result, { checked: true });
  assert.equal(result.killed, false);
});

test("browser runner rejects driver errors and terminates its own subprocess", async () => {
  await assert.rejects(runBrowserProcess(process.execPath, ["-e", 'setInterval(() => {}, 1000);'], 45000,
    async () => { throw new Error("driver failed"); }), /driver failed/);
});

test("browser runner rejects clean exit before driver completion", async () => {
  await assert.rejects(runBrowserProcess(process.execPath, ["-e", 'process.exit(0);'], 45000,
    () => new Promise(() => {})), /exited before driver completed/);
});

const protocolProcess = `
const fs = require("node:fs");
const mode = process.argv[1];
const input = fs.createReadStream(null, {fd:3});
const output = fs.createWriteStream(null, {fd:4});
let buffer = Buffer.alloc(0), polls = 0;
const reply = (message) => {
  const bytes = Buffer.from(JSON.stringify(message) + "\\0");
  if (mode === "fragmented") {
    const event = Buffer.from(JSON.stringify({method:"Target.targetInfoChanged", params:{title:"event"}}) + "\\0");
    const combined = Buffer.concat([event, bytes]);
    const unicode = combined.indexOf(Buffer.from("ا"));
    const split = unicode < 0 ? Math.floor(combined.length / 2) : unicode + 1;
    output.write(combined.subarray(0, split));
    setTimeout(() => output.write(combined.subarray(split)), 50);
  } else output.write(bytes);
};
input.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let end;
  while ((end = buffer.indexOf(0)) !== -1) {
    const request = JSON.parse(buffer.subarray(0, end).toString());
    buffer = buffer.subarray(end + 1);
    if (request.method === "Browser.close") { process.exit(0); }
    if (mode === "invalid") { output.write("invalid JSON\\0"); continue; }
    if (mode === "early-close") { process.exit(0); }
    if (mode === "protocol-error") { reply({id:request.id,error:{message:"protocol rejected"}}); continue; }
    let result = {};
    if (request.method === "Target.createTarget") result = {targetId:"real-pipe-target"};
    if (request.method === "Target.attachToTarget") result = {sessionId:"real-pipe-session"};
    if (request.method === "Runtime.evaluate") {
      if (mode === "evaluation-error") result = {exceptionDetails:{text:"evaluation failed"}};
      else result = {result:{value: mode === "poll-once" && polls++ === 0 ? null :
        {status:"passed",label:"العربية",encoded:encodeURIComponent(JSON.stringify({label:"عدد الفعاليات"}))}}};
    }
    reply({id:request.id,result});
  }
});
`;

for (const mode of ["poll-once", "fragmented"]) {
  test(`calendar protocol handles ${mode} over real process pipes`, async () => {
    const result = await runBrowserProcess(process.execPath, ["-e", protocolProcess, mode], 45000,
      (child) => readCalendarReceipt(child, "http://127.0.0.1/calendar/"));
    assert.equal(result.result.status, "passed");
    assert.equal(result.result.label, "العربية");
    assert.deepEqual(JSON.parse(decodeURIComponent(result.result.encoded)), { label: "عدد الفعاليات" });
    assert.equal(result.killed, false);
  });
}

for (const [mode, error] of [["invalid", SyntaxError], ["protocol-error", /protocol rejected/],
  ["evaluation-error", /evaluation failed/], ["early-close", /pipe closed|driver completed/]]) {
  test(`calendar protocol rejects ${mode} over real process pipes`, async () => {
    await assert.rejects(runBrowserProcess(process.execPath, ["-e", protocolProcess, mode], 45000,
      (child) => readCalendarReceipt(child, "http://127.0.0.1/calendar/")), error);
  });
}
