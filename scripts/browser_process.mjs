import { spawn } from "node:child_process";

export function runBrowserProcess(executable, args, timeout = 45000, drive) {
  const started = Date.now();
  return new Promise((accept, reject) => {
    const isolatedGroup = process.platform !== "win32";
    const child = spawn(executable, args, { detached: isolatedGroup, stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
    let forceTimer;
    let terminated = false;
    let closed = false;
    const signalGroup = signal => {
      if (!child.pid) return;
      if (!isolatedGroup) { child.kill(signal); return; }
      try { process.kill(-child.pid, signal); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    };
    const terminate = () => {
      if (closed) return;
      terminated = true;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        try { signalGroup("SIGTERM"); }
        catch (error) { reject(error); }
      }
      forceTimer ??= setTimeout(() => {
        if (closed) return;
        try { signalGroup("SIGKILL"); }
        catch (error) { reject(error); }
        finally { for (const stream of child.stdio.slice(1)) stream?.destroy(); }
      }, 1000);
    };
    const deadline = setTimeout(terminate, timeout);
    const cleanup = () => { clearTimeout(deadline); clearTimeout(forceTimer); };
    let stdout = "", stderr = "";
    let result;
    let driveFinished = !drive;
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", (code, signal) => {
      closed = true;
      cleanup();
      if (terminated || child.killed || signal || code !== 0) {
        reject(new Error(`Browser failed: killed=${terminated || child.killed}, exit=${code}, signal=${signal}; ${stderr}; stdout=${stdout.slice(0, 200)}`));
        return;
      }
      if (!driveFinished) {
        reject(new Error("Browser exited before driver completed"));
        return;
      }
      accept({ stdout, stderr, result, exitCode: code, elapsedMs: Date.now() - started, killed: false });
    });
    if (drive) {
      Promise.resolve().then(() => drive(child)).then((value) => { result = value; driveFinished = true; }, (error) => {
        reject(error);
        terminate();
      });
    }
  });
}
