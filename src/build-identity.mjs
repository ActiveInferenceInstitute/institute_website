import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Identity of the website inputs, independent of checkout location and build clock. */
export function websiteSourceFingerprint(root) {
  const hash = createHash("sha256");
  const generatedAssets = new Set(["assets/js/redirects.js", "assets/js/search-data.js"]);
  const visit = relative => {
    const file = path.join(root, relative);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new TypeError("Website source identity cannot follow symlinks");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) visit(path.posix.join(relative, name));
    } else if (!generatedAssets.has(relative) && relative !== "simulations/index.html" &&
      (!relative.startsWith("simulations/") || relative.endsWith(".html"))) {
      const data = fs.readFileSync(file);
      hash.update(JSON.stringify([relative, data.length]) + "\n"); hash.update(data);
    }
  };
  for (const entry of ["package.json", "src", "assets", "simulations"]) visit(entry);
  // The renderer also reads these public export inputs outside src/content.
  const dataDir = fs.lstatSync(path.join(root, "data"), { throwIfNoEntry: false });
  if (dataDir?.isSymbolicLink()) throw new TypeError("Website source identity cannot follow symlinks");
  for (const entry of ["data/export-manifest.json", "data/projects.json"]) {
    if (fs.lstatSync(path.join(root, entry), { throwIfNoEntry: false })) visit(entry);
  }
  return hash.digest("hex");
}
