import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "src", "content");

const out = (...parts) => path.join(root, ...parts);
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, relativePath), "utf8"));
}

const pages = fs
  .readdirSync(path.join(contentDir, "pages"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => loadJson(path.join("pages", file)))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug));

const siteData = {
  site: loadJson("site.json"),
  navigation: loadJson("navigation.json"),
  social: loadJson("social.json"),
  metrics: loadJson("metrics.json"),
  liveSources: loadJson("live-sources.json"),
  pages,
};
const pdfData = loadJson("pdf-pages.json");
const liveSourceById = new Map((siteData.liveSources.sources || []).map((source) => [source.id, source]));
const pageBySlug = new Map(siteData.pages.map((page) => [page.slug, page]));

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugToHref = (slug) => (slug === "index" ? "index.html" : `${slug}.html`);

const slugifyAnchor = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function relPrefix(currentPath) {
  return currentPath.includes("/") ? "../" : "";
}

function absoluteUrl(filePath = "") {
  const baseUrl = siteData.site.baseUrl.endsWith("/") ? siteData.site.baseUrl : `${siteData.site.baseUrl}/`;
  let clean = String(filePath).replace(/^\/+/, "");
  if (clean === "index.html") {
    clean = "";
  } else if (clean.endsWith("/index.html")) {
    clean = clean.slice(0, -"index.html".length);
  }
  return new URL(clean, baseUrl).toString();
}

function nav(prefix = "") {
  const items = siteData.navigation
    .map((item) => `<a href="${prefix}${item.href}">${escapeHtml(item.label)}</a>`)
    .join("");
  return `<nav class="nav" aria-label="Primary">${items}</nav>`;
}

function resolveLinks(links = []) {
  return links
    .map((link) => {
      if (link.sourceId) {
        const source = liveSourceById.get(link.sourceId);
        if (!source || !source.ok) {
          return null;
        }
        return {
          label: link.label || source.label,
          href: source.finalUrl || source.url,
          meta: source.category,
        };
      }
      if (link.href && link.label) {
        return link;
      }
      return null;
    })
    .filter(Boolean);
}

function linkChips(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="link-chips">${resolved
    .map(
      (link) => `<a href="${escapeHtml(link.href)}">
        <span>${escapeHtml(link.label)}</span>
        ${link.meta ? `<em>${escapeHtml(link.meta)}</em>` : ""}
      </a>`,
    )
    .join("")}</div>`;
}

function pageGuide(page) {
  const sectionLinks = page.sections
    .map((section) => `<a href="#${escapeHtml(slugifyAnchor(section.heading))}">${escapeHtml(section.heading)}</a>`)
    .join("");
  return `<section class="content-band page-index-band">
    <div class="page-index">
      <div>
        <p class="eyebrow">On this page</p>
        <h2>${escapeHtml(page.title)} guide</h2>
      </div>
      <nav aria-label="${escapeHtml(page.title)} page sections">
        ${sectionLinks}
        <a href="#source-coverage">Source coverage</a>
        <a href="#verified-links">Verified links</a>
        <a href="#related-pages">Related pages</a>
      </nav>
    </div>
  </section>`;
}

function layout({ title, description, currentPath, body, extraHead = "", bodyClass = "" }) {
  const prefix = relPrefix(currentPath);
  const pageTitle = title === siteData.site.name ? title : `${title} | ${siteData.site.name}`;
  const pageDescription = description || siteData.site.description;
  const canonicalUrl = absoluteUrl(currentPath);
  const previewImage = absoluteUrl("assets/img/source-page-001.png");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <meta name="theme-color" content="#050505">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(siteData.site.name)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(previewImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">
  ${extraHead}
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="${prefix}index.html" aria-label="${escapeHtml(siteData.site.name)} home">
      <span class="brand-mark">AI</span>
      <span>
        <strong>${escapeHtml(siteData.site.name)}</strong>
        <em>${escapeHtml(siteData.site.tagline)}</em>
      </span>
    </a>
    ${nav(prefix)}
  </header>
  <main id="main">
    ${body}
  </main>
  <footer class="site-footer">
    <div>
      <strong>${escapeHtml(siteData.site.name)}</strong>
      <p>${escapeHtml(siteData.site.description)}</p>
    </div>
    <div class="footer-links">
      <a href="mailto:${escapeHtml(siteData.site.email)}">${escapeHtml(siteData.site.email)}</a>
      <a href="${prefix}${siteData.site.sourcePdf}">Source PDF</a>
      <a href="${prefix}atlas/">Source Atlas</a>
      <a href="${prefix}source.html">Source Manifest</a>
    </div>
    <div class="social-links" aria-label="Verified public links">
      ${siteData.social.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
    </div>
  </footer>
  <script src="${prefix}assets/js/site.js" defer></script>
</body>
</html>`;
}

function sectionHeading({ eyebrow, title, text }) {
  const parts = ['<div class="section-heading">'];
  if (eyebrow) {
    parts.push(`    <p class="eyebrow">${escapeHtml(eyebrow)}</p>`);
  }
  parts.push(`    <h2>${escapeHtml(title)}</h2>`);
  if (text) {
    parts.push(`    <p>${escapeHtml(text)}</p>`);
  }
  parts.push("  </div>");
  return parts.join("\n");
}

function cardGrid(cards = []) {
  return `<div class="card-grid">${cards
    .map((card) => {
      const links = linkChips(card.links);
      return `<article class="info-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.text)}</p>${links ? `\n        ${links}` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function sourceLinks(range) {
  return `<p class="source-range">Source coverage: <a href="#source-coverage">${escapeHtml(range)}</a>. Browse the <a href="atlas/">page-by-page Source Atlas</a>.</p>`;
}

function relatedSlugsForPage(page) {
  if (Array.isArray(page.relatedSlugs) && page.relatedSlugs.length) {
    return page.relatedSlugs;
  }
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  return [siteData.pages[index - 1]?.slug, siteData.pages[index + 1]?.slug].filter(Boolean);
}

function relatedPages(page) {
  const related = relatedSlugsForPage(page).map((slug) => pageBySlug.get(slug)).filter(Boolean);
  return `<div class="source-grid compact-grid">${related
    .map(
      (relatedPage) => `<a class="source-card" href="${slugToHref(relatedPage.slug)}">
        <span>${escapeHtml(relatedPage.sourceRange)}</span>
        <strong>${escapeHtml(relatedPage.title)}</strong>
        <p>${escapeHtml(relatedPage.lede)}</p>
      </a>`,
    )
    .join("")}</div>`;
}

function verifiedExternalLinks(page) {
  const links = resolveLinks((page.externalSourceIds || []).map((sourceId) => ({ sourceId })));
  if (!links.length) {
    return '<p class="lede">No live external links are assigned to this page yet. Use the Source Manifest for the complete verified list.</p>';
  }
  return `<div class="external-grid">${links
    .map(
      (link) => `<a class="external-card" href="${escapeHtml(link.href)}">
        <span>${escapeHtml(link.meta || "Verified source")}</span>
        <strong>${escapeHtml(link.label)}</strong>
      </a>`,
    )
    .join("")}</div>`;
}

function publicPagePager(page) {
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  const prev = siteData.pages[index - 1];
  const next = siteData.pages[index + 1];
  return `<nav class="pager page-pager" aria-label="${escapeHtml(page.title)} adjacent pages">
    ${prev ? `<a href="${slugToHref(prev.slug)}">Previous: ${escapeHtml(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${slugToHref(next.slug)}">Next: ${escapeHtml(next.title)}</a>` : "<span></span>"}
  </nav>`;
}

function homePage() {
  const featured = pdfData.pages.filter((page) => [1, 4, 22, 58, 87, 167].includes(page.number));
  const programPage = siteData.pages.find((page) => page.slug === "programs");
  const projectPage = siteData.pages.find((page) => page.slug === "projects");
  const ecosystemPage = siteData.pages.find((page) => page.slug === "ecosystem");
  const body = `
  <section class="hero">
    <img class="hero-art" src="assets/img/source-page-001.png" alt="" aria-hidden="true">
    <div class="hero-inner">
      <p class="eyebrow">Public information website</p>
      <h1>${escapeHtml(siteData.site.name)}</h1>
      <p class="hero-copy">${escapeHtml(siteData.site.description)}</p>
      <div class="hero-actions">
        <a class="button primary" href="get-involved.html">Get involved</a>
        <a class="button secondary" href="atlas/">Explore the source atlas</a>
      </div>
    </div>
  </section>

  <section class="metrics-band" aria-label="Institute summary">
    ${siteData.metrics
      .map((metric) => `<div><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`)
      .join("")}
  </section>

  <section class="content-band">
    ${sectionHeading({
      eyebrow: "Refactored from the source PDF",
      title: "A public map for the Institute and ecosystem",
      text: "The source PDF is a living institutional document. This site turns it into stable public pages while preserving a page-by-page atlas for auditability.",
    })}
    <div class="feature-layout">
      <article>
        <h3>Education, research, training, and applications</h3>
        <p>AII supports the Active Inference ecosystem through recurring learning groups, research projects, open source work, media production, public events, partnerships, and institutional stewardship.</p>
        <p>The site is organized for visitors who need an overview first, then source-level detail when they want it.</p>
      </article>
      <div class="thumb-stack" aria-label="Source document previews">
        <img src="assets/img/source-page-004.png" alt="Activities page preview from the source PDF">
        <img src="assets/img/source-page-058.png" alt="Programs page preview from the source PDF">
        <img src="assets/img/source-page-167.png" alt="Ecosystem page preview from the source PDF">
      </div>
    </div>
  </section>

  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Core areas", title: "How the work is organized" })}
    ${cardGrid([
      { title: "Institute", text: "Mission, history, structure, communications, values, governance, and public channels." },
      { title: "Programs", text: programPage.lede },
      { title: "Projects", text: projectPage.lede },
      { title: "Learning", text: "Textbook groups, courses, podcasts, livestreams, readings, implementations, and research resources." },
      { title: "Ecosystem", text: ecosystemPage.lede },
      { title: "Get involved", text: "Discord, activities, volunteer paths, partnerships, philanthropy, and contact details." },
    ])}
  </section>

  <section class="content-band">
    ${sectionHeading({ eyebrow: "Source coverage", title: "Featured source pages", text: "Every PDF page has a generated atlas page. These featured pages show the major source sections." })}
    <div class="source-grid">
      ${featured
        .map(
          (page) => `<a class="source-card" href="atlas/${page.slug}.html">
            <span>Page ${page.number}</span>
            <strong>${escapeHtml(page.title)}</strong>
            <p>${escapeHtml(page.summary)}</p>
          </a>`,
        )
        .join("")}
    </div>
  </section>`;
  return layout({
    title: siteData.site.name,
    currentPath: "index.html",
    description: siteData.site.description,
    body,
    bodyClass: "home",
  });
}

function publicPage(page) {
  const body = `
  <section class="page-hero compact">
    <p class="eyebrow">${escapeHtml(page.sourceRange)}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.subtitle)}</p>
  </section>
  ${pageGuide(page)}
  <section class="content-band">
    <p class="lede">${escapeHtml(page.lede)}</p>
    ${sourceLinks(page.sourceRange)}
    <div class="article-stack">
      ${page.sections
        .map((section) => {
          const links = linkChips(section.links);
          return `<article class="article-block" id="${escapeHtml(slugifyAnchor(section.heading))}">
            <h2>${escapeHtml(section.heading)}</h2>
            <p>${escapeHtml(section.body)}</p>${links ? `\n            ${links}` : ""}
          </article>`;
        })
        .join("")}
    </div>
  </section>
  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards)}
  </section>
  <section class="content-band" id="source-coverage">
    ${sectionHeading({ eyebrow: "Source coverage", title: "PDF traceability", text: `This page is summarized from ${page.sourceRange}. Use these source pages and the full atlas to audit the public summary.` })}
    ${relatedSourcePages(page.sourceRange)}
  </section>
  <section class="content-band muted" id="verified-links">
    ${sectionHeading({ eyebrow: "Verified external links", title: "Public resources and repositories", text: "These links resolve through the live-source manifest, so volatile destinations stay centralized and auditable." })}
    ${verifiedExternalLinks(page)}
  </section>
  <section class="content-band" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the site" })}
    ${relatedPages(page)}
  </section>
  ${publicPagePager(page)}`;
  return layout({
    title: page.title,
    description: page.lede,
    currentPath: `${page.slug}.html`,
    body,
  });
}

function pageNumbersFromRange(range) {
  const matches = [...range.matchAll(/(\d+)(?:-(\d+))?/g)];
  const numbers = new Set();
  for (const match of matches) {
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    for (let i = start; i <= end; i += Math.max(1, Math.ceil((end - start + 1) / 6))) {
      numbers.add(i);
    }
  }
  return [...numbers].slice(0, 8);
}

function relatedSourcePages(range) {
  const numbers = pageNumbersFromRange(range);
  const pages = pdfData.pages.filter((page) => numbers.includes(page.number));
  return `<div class="source-grid compact-grid">${pages
    .map(
      (page) => `<a class="source-card" href="atlas/${page.slug}.html">
        <span>Page ${page.number}</span>
        <strong>${escapeHtml(page.title)}</strong>
        <p>${escapeHtml(page.summary)}</p>
      </a>`,
    )
    .join("")}</div>`;
}

function atlasIndex() {
  const sectionOptions = pdfData.sections
    .map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.label)} (${section.start}-${section.end})</option>`)
    .join("");
  const items = pdfData.pages
    .map(
      (page) => `<a class="atlas-row" href="${page.slug}.html" data-section="${escapeHtml(page.section)}" data-search="${escapeHtml(`${page.title} ${page.summary} ${page.text}`.toLowerCase())}">
        <span>Page ${page.number}</span>
        <strong>${escapeHtml(page.title)}</strong>
        <em>${escapeHtml(page.sectionLabel)}</em>
        <p>${escapeHtml(page.summary)}</p>
      </a>`,
    )
    .join("");
  const body = `
  <section class="page-hero compact">
    <p class="eyebrow">${pdfData.source.reportedPages} PDF pages</p>
    <h1>Source Atlas</h1>
    <p>A page-by-page map of the source PDF. Use it to audit coverage, find source wording, and move from curated public pages back to the original document structure.</p>
  </section>
  <section class="content-band">
    <div class="atlas-tools">
      <label>
        <span>Search source pages</span>
        <input id="atlas-search" type="search" placeholder="Search projects, programs, domains, people, or channels">
      </label>
      <label>
        <span>Filter section</span>
        <select id="atlas-section">
          <option value="">All sections</option>
          ${sectionOptions}
        </select>
      </label>
    </div>
    <p id="atlas-count" class="result-count">${pdfData.pages.length} pages shown</p>
    <div class="atlas-list" id="atlas-list">${items}</div>
  </section>`;
  return layout({
    title: "Source Atlas",
    description: "Searchable page-by-page atlas of the Active Inference Institute source PDF.",
    currentPath: "atlas/index.html",
    body,
    extraHead: '<script src="../assets/js/atlas.js" defer></script>',
  });
}

function sourcePage(page) {
  const prev = pdfData.pages.find((candidate) => candidate.number === page.number - 1);
  const next = pdfData.pages.find((candidate) => candidate.number === page.number + 1);
  const thumbPath = `../assets/img/source-page-${String(page.number).padStart(3, "0")}.png`;
  const thumbExists = fs.existsSync(out("assets", "img", `source-page-${String(page.number).padStart(3, "0")}.png`));
  const body = `
  <section class="page-hero compact">
    <p class="eyebrow">${escapeHtml(page.sectionLabel)} / Page ${page.number}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.summary)}</p>
  </section>
  <section class="content-band source-page-layout">
    <article class="source-text">
      <h2>Extracted text</h2>
      <pre>${escapeHtml(page.text || "Blank or spacer page in the source PDF.")}</pre>
    </article>
    <aside class="source-aside">
      ${thumbExists ? `<img src="${thumbPath}" alt="Rendered preview of source PDF page ${page.number}">` : ""}
      <a class="button secondary full" href="../${siteData.site.sourcePdf}">Download source PDF</a>
      <a class="button secondary full" href="./">Back to atlas</a>
    </aside>
  </section>
  <nav class="pager" aria-label="Source page navigation">
    ${prev ? `<a href="${prev.slug}.html">Previous: page ${prev.number}</a>` : "<span></span>"}
    ${next ? `<a href="${next.slug}.html">Next: page ${next.number}</a>` : "<span></span>"}
  </nav>`;
  return layout({
    title: `Page ${page.number}: ${page.title}`,
    description: page.summary,
    currentPath: `atlas/${page.slug}.html`,
    body,
  });
}

function sourceManifest() {
  const liveSources = siteData.liveSources.sources || [];
  const verifiedCount = liveSources.filter((source) => source.ok).length;
  const knownUnavailableCount = liveSources.filter((source) => !source.ok).length;
  const sourceRows = liveSources
    .map((source) => {
      const finalUrl = source.finalUrl || source.url;
      const statusText = source.ok
        ? `Verified ${source.statusCode}`
        : `Not promoted ${source.statusCode || "unavailable"}`;
      const label = source.ok
        ? `<a href="${escapeHtml(finalUrl)}">${escapeHtml(source.label)}</a>`
        : `<span>${escapeHtml(source.label)}</span>`;
      return `<tr>
        <td>${label}</td>
        <td>${escapeHtml(source.category)}</td>
        <td><span class="status-pill ${source.ok ? "ok" : "warn"}">${escapeHtml(statusText)}</span></td>
        <td>${escapeHtml(source.sourceBasis)}</td>
      </tr>`;
    })
    .join("");
  const body = `
  <section class="page-hero compact">
    <p class="eyebrow">Source and maintenance</p>
    <h1>How this website is built</h1>
    <p>The website separates curated public pages from generated source coverage. This makes the public narrative readable while keeping the PDF traceable and volatile public links explicit.</p>
  </section>
  <section class="content-band">
    ${sectionHeading({
      eyebrow: "Accuracy policy",
      title: "PDF + Live source contract",
      text: siteData.liveSources.policy || siteData.site.accuracyPolicy,
    })}
    <div class="manifest-summary">
      <div><strong>${pdfData.source.reportedPages}</strong><span>PDF pages reported</span></div>
      <div><strong>${pdfData.source.extractedPages}</strong><span>PDF pages extracted</span></div>
      <div><strong>${verifiedCount}</strong><span>Live sources verified</span></div>
      <div><strong>${knownUnavailableCount}</strong><span>Known unavailable, not promoted</span></div>
    </div>
    <p class="source-range">Live-source checks last ran ${escapeHtml(siteData.liveSources.lastCheckedAt)}. PDF-derived institutional summaries remain source-backed unless a reachable public source clearly updates a volatile detail.</p>
  </section>
  <section class="content-band">
    ${cardGrid([
      { title: "Curated pages", text: "Edited public pages live in src/content/pages/*.json." },
      { title: "Shared site data", text: "Navigation, metrics, social links, site metadata, and live-source checks live in split JSON files under src/content/." },
      { title: "Source atlas", text: "scripts/extract_pdf.py extracts all PDF pages into src/content/pdf-pages.json." },
      { title: "Static generator", text: "src/build.mjs renders the root HTML files and atlas pages for GitHub Pages." },
      { title: "No runtime framework", text: "The site is plain HTML, CSS, and JavaScript for durability and simple hosting." },
    ])}
  </section>
  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Live verification", title: "Checked public sources" })}
    <div class="table-wrap">
      <table class="source-table">
        <thead>
          <tr><th>Source</th><th>Category</th><th>Status</th><th>Basis</th></tr>
        </thead>
        <tbody>${sourceRows}</tbody>
      </table>
    </div>
  </section>`;
  return layout({
    title: "Source Manifest",
    description: "Build and source contract for the Active Inference Institute website.",
    currentPath: "source.html",
    body,
  });
}

function writeFile(file, html) {
  ensure(path.dirname(out(file)));
  fs.writeFileSync(out(file), html, "utf8");
}

function build() {
  writeFile("index.html", homePage());
  for (const page of siteData.pages) {
    writeFile(`${page.slug}.html`, publicPage(page));
  }
  writeFile("source.html", sourceManifest());
  writeFile("atlas/index.html", atlasIndex());
  for (const page of pdfData.pages) {
    writeFile(`atlas/${page.slug}.html`, sourcePage(page));
  }
  writeFile(
    "404.html",
    layout({
      title: "Page not found",
      currentPath: "404.html",
      body: '<section class="page-hero compact"><h1>Page not found</h1><p>Use the navigation to return to the Institute website.</p><a class="button primary" href="index.html">Home</a></section>',
    }),
  );
  writeFile(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("sitemap.xml")}\n`,
  );
  const urls = [
    "index.html",
    ...siteData.pages.map((page) => `${page.slug}.html`),
    "source.html",
    "atlas/",
    ...pdfData.pages.map((page) => `atlas/${page.slug}.html`),
  ];
  writeFile(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${absoluteUrl(url)}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
  );
  console.log(`Built ${urls.length} public pages plus 404.html`);
}

build();
