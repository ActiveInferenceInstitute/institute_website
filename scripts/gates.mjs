import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.GNN_PYTHON || "python3";
const arms = {
  lint: [["npm", "run", "check:syntax"]],
  fast: [["npm", "run", "check:i18n"]],
  full: [["npm", "run", "check"]],
  docs: [["npm", "run", "check:md-links"]],
  gnn: [[python, "scripts/check_gnn_conformance.py"]],
  build: [["npm", "run", "build"]],
  browser: [
    ["npm", "run", "check:browser"],
    ["npm", "run", "check:browser:archive"],
    ["node", "scripts/check_audit_browser.mjs", "--quick"],
  ],
};
const [arm = "fast", ...args] = process.argv.slice(2);
if (arm === "--list") {
  console.log(JSON.stringify(arms, null, 2));
} else if (!Object.hasOwn(arms, arm) || (args.length && arm !== "gnn")) {
  console.error("Usage: ./run.sh [" + Object.keys(arms).join("|") + "] (default: fast); gnn accepts --exemplar PATH");
  process.exitCode = 2;
} else {
  for (const command of arms[arm]) {
    const result = spawnSync(command[0], [...command.slice(1), ...args], { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.signal || result.status === null) throw new Error(arm + " terminated without an exit status");
    if (result.status !== 0) { process.exitCode = result.status; break; }
  }
}
