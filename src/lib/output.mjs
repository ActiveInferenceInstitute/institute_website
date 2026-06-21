// ── File output ──────────────────────────────────────────────────────────────
// Writes a generated file under the repo root, creating parent dirs and
// trimming trailing horizontal whitespace per line so output stays byte-stable.
import fs from "node:fs";
import path from "node:path";
import { out, ensure } from "./paths.mjs";

export function writeFile(file, html) {
  ensure(path.dirname(out(file)));
  fs.writeFileSync(out(file), html.replace(/[ \t]+$/gm, ""), "utf8");
}
