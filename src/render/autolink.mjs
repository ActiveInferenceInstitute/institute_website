import { hrefForSlug } from "../url-taxonomy.mjs";
import { loadProjectsData } from "../data.mjs";

// Curated, high-confidence internal link targets. Each {names, slug, anchor}
// links the FIRST plain-text occurrence of a name on a page to its canonical
// on-site page. Kept tight so the auto-linker never over-links generic words;
// every target resolves to a real internal page (the build's link checker fails
// on any broken href). Names are matched longest-first, whole-word, never inside
// an existing tag/anchor.
function curatedTargets() {
  const targets = [
    { names: ["Active Inference Institute"], slug: "about" },
    { names: ["Board of Directors", "BoD"], slug: "board-of-directors" },
    { names: ["Scientific Advisory Board", "SAB"], slug: "scientific-advisory-board" },
    { names: ["Officers"], slug: "officers" },
    { names: ["EduActive"], slug: "eduactive" },
    { names: ["ReInference"], slug: "reinference" },
    { names: ["Research Fellows", "Fellowship"], slug: "fellowship" },
    { names: ["Internship"], slug: "internship" },
    { names: ["Mentorship"], slug: "mentorship" },
    { names: ["Partnerships", "Partnership"], slug: "partnership" },
    { names: ["Philanthropy"], slug: "philanthropy" },
  ];
  // Flagship projects by exact, specific title (≥ 12 chars to avoid generic words).
  const projects = (loadProjectsData().projects || []).filter((p) => p && p.website_slug && (p.title || "").length >= 12);
  for (const p of projects) {
    targets.push({ names: [p.title], slug: p.website_slug });
  }
  return targets;
}

let _compiled = null;
function compiledTargets() {
  if (_compiled) {
    return _compiled;
  }
  const flat = [];
  for (const t of curatedTargets()) {
    for (const name of t.names) {
      flat.push({ key: t.slug + (t.anchor || ""), name, slug: t.slug, anchor: t.anchor || "" });
    }
  }
  // Longest names first so "Active Inference Institute" wins over a shorter overlap.
  flat.sort((a, b) => b.name.length - a.name.length);
  _compiled = flat;
  return _compiled;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Link the first plain-text occurrence of each curated target inside an HTML
// fragment. Operates only on text between tags, skips content already inside an
// <a>, and links each target at most once per fragment.
export function autolinkInternal(html, currentDir = "") {
  if (!html) {
    return html;
  }
  const targets = compiledTargets();
  const parts = String(html).split(/(<[^>]+>)/);
  let depthInAnchor = 0;
  const used = new Set();
  for (let i = 0; i < parts.length; i += 1) {
    const seg = parts[i];
    if (seg.startsWith("<")) {
      if (/^<a\b/i.test(seg)) {
        depthInAnchor += 1;
      } else if (/^<\/a>/i.test(seg)) {
        depthInAnchor = Math.max(0, depthInAnchor - 1);
      }
      continue;
    }
    if (depthInAnchor > 0 || !seg.trim()) {
      continue;
    }
    let text = seg;
    for (const t of targets) {
      if (used.has(t.key)) {
        continue;
      }
      const re = new RegExp(`(^|[^\\w/#&-])(${escapeRegex(t.name)})(?![\\w/-])`);
      const m = re.exec(text);
      if (m) {
        const href = hrefForSlug(t.slug, currentDir, t.anchor);
        const before = text.slice(0, m.index);
        const after = text.slice(m.index + m[0].length);
        text = `${before}${m[1]}<a href="${href}">${m[2]}</a>${after}`;
        used.add(t.key);
      }
    }
    parts[i] = text;
  }
  return parts.join("");
}
