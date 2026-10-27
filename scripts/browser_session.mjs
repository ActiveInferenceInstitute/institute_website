import { runBrowserProcess } from "./browser_process.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Isolated real Chrome, with bounded protocol calls and complete teardown. */
export async function browserSession(chrome, drive) {
  const profile = await mkdtemp(join(tmpdir(), "website-audit-browser-"));
  return runBrowserProcess(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--mute-audio", "--remote-debugging-pipe", `--user-data-dir=${profile}`, "about:blank"], 60000, async child => {
    let next = 0, buffer = Buffer.alloc(0);
    const pending = new Map(), events = [];
    const fail = error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); };
    child.stdio[3].on("error", fail);
    child.stdio[4].on("error", fail);
    child.stdio[4].on("close", () => fail(new Error("Chrome protocol closed")));
    child.stdio[4].on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      let end;
      while ((end = buffer.indexOf(0)) !== -1) {
        let message;
        try { message = JSON.parse(buffer.subarray(0, end).toString()); }
        catch (error) { fail(error); return; }
        buffer = buffer.subarray(end + 1);
        if (!message.id) { events.push(message); continue; }
        const p = pending.get(message.id);
        if (!p) continue;
        clearTimeout(p.timer); pending.delete(message.id);
        if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
      }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome protocol timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    const version = await send("Browser.getVersion");
    const evaluate = async expression => {
      const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
    const result = await drive({ command, evaluate, events });
    await send("Target.closeTarget", { targetId });
    // Chrome closes its protocol pipe while answering Browser.close; do not
    // register an unresolvable pending request for that shutdown message.
    child.stdio[3].write(JSON.stringify({ id: ++next, method: "Browser.close" }) + "\0");
    return { ...result, browserVersion: version.product, protocolVersion: version.protocolVersion };
  });
}
