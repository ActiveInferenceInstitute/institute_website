#!/usr/bin/env node
/**
 * Guards the /projects/ index page against silently dropping project links.
 *
 * Before the project catalog section existed, /projects/index.html only linked
 * 21 of the 61 public projects that have a real website page (website_slug set
 * in data/projects.json) — the rest were hand-curated into narrative "sections"
 * one at a time and the other 40 were reachable only via /directory/ or another
 * project's related-projects panel. This check reads the BUILT HTML directly
 * (not the render function that produces it) so a future refactor that narrows
 * the catalog filter, breaks the search markup, or reintroduces a hand-curated
 * subset fails CI instead of silently degrading discoverability again.
 *
 * Run via `npm run check:catalog`, after `npm run build` has produced
 * projects/index.html and its locale variants.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = join(ROOT, "data", "projects.json");
const PROJECTS_INDEX = join(ROOT, "projects", "index.html");

function expectedRelativeSlugs() {
  const { projects } = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  return projects
    .filter((project) => project.website_slug)
    .map((project) => project.website_slug.replace(/^project-/, ""));
}

function main() {
  if (!existsSync(PROJECTS_INDEX)) {
    console.error(`Project catalog check failed: ${PROJECTS_INDEX} does not exist -- run 'npm run build' first.`);
    return 1;
  }
  const html = readFileSync(PROJECTS_INDEX, "utf8");
  const expected = expectedRelativeSlugs();
  const missing = expected.filter((slug) => !html.includes(`href="${slug}/"`));

  if (missing.length) {
    console.error(
      `Project catalog check failed: ${missing.length} of ${expected.length} public project pages ` +
        `are not linked from projects/index.html:`,
    );
    for (const slug of missing) {
      console.error(`- ${slug}`);
    }
    return 1;
  }

  console.log(`Project catalog check passed: all ${expected.length} public project pages linked from projects/index.html.`);
  return 0;
}

process.exit(main());
