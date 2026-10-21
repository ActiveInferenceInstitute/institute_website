import { spawn } from "node:child_process";

export function runBrowserProcess(executable, args, timeout = 45000, drive) {
  const started = Date.now();
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { timeout, stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    let result;
    let driveFinished = !drive;
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (child.killed || signal || code !== 0) {
        reject(new Error(`Browser failed: killed=${child.killed}, exit=${code}, signal=${signal}; ${stderr}; stdout=${stdout.slice(0, 200)}`));
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
        child.kill();
      });
    }
  });
}
