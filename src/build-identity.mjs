import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Content identity, independent of checkout location, clock and export timestamp. */
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
  return hash.digest("hex");
}
