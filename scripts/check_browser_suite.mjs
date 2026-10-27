import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function createEvidenceDirectory(websiteRoot, parent) {
  const root = realpathSync(websiteRoot);
  const outside = directory => {
    const rel = relative(root, directory);
    return rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel);
  };
  const requested = resolve(parent);
  if (!outside(requested)) throw new Error("Browser evidence must be outside the public checkout");
  mkdirSync(requested, { recursive: true });
  const actual = realpathSync(requested);
  if (!outside(actual)) throw new Error("Browser evidence cannot follow a symlink into the public checkout");
  return mkdtempSync(join(actual, "website-browser-suite-"));
}

export function runSequential(steps, cwd, env = process.env) {
  const results = [];
  for (const step of steps) {
    const result = spawnSync(process.execPath, step.argv, { cwd, env: { ...env, ...step.env }, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.signal) throw new Error(step.name + " terminated by " + result.signal);
    if (result.status === null) throw new Error(step.name + " returned no exit status");
    results.push({ name: step.name, exitCode: result.status });
    if (result.status !== 0) return { exitCode: result.status, results };
  }
  return { exitCode: 0, results };
}

function main() {
  if (!process.env.CHROME_BIN) throw new Error("Set CHROME_BIN to a working Chrome or Chromium executable");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = createEvidenceDirectory(root, process.env.WEBSITE_AUDIT_OUTPUT || tmpdir());
  console.log("Browser suite evidence: " + output);
  const steps = [
    { name: "calendar", argv: [join(root, "scripts/check_calendar_browser.mjs")] },
    { name: "interactions", argv: [join(root, "scripts/check_audit_browser.mjs")], env: { WEBSITE_AUDIT_OUTPUT: join(output, "interactions") } },
    { name: "archive", argv: [join(root, "scripts/check_audit_browser.mjs"), "--archive"], env: { WEBSITE_AUDIT_OUTPUT: join(output, "archive") } },
  ];
  try {
    const result = runSequential(steps, root);
    writeFileSync(join(output, "suite-result.json"), JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.exitCode;
  } catch (error) {
    writeFileSync(join(output, "suite-error.json"), JSON.stringify({ error: String(error) }, null, 2) + "\n");
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
