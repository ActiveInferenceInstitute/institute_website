// ── Output path helpers ──────────────────────────────────────────────────────
// Pure path helpers over the repo root. Kept out of data.mjs so no back-edge
// from lib/output.mjs -> data.mjs becomes a value cycle.
import path from "node:path";
import fs from "node:fs";
import { root } from "../data.mjs";

export const out = (...parts) => path.join(root, ...parts);
export const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
