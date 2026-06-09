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
  resources: loadJson("resources.json"),
  pages,
};

const liveSourceById = new Map((siteData.liveSources.sources || []).map((source) => [source.id, source]));
const pageBySlug = new Map(siteData.pages.map((page) => [page.slug, page]));
const resourceCategoryById = new Map((siteData.resources.categories || []).map((category) => [category.id, category]));

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

function resolveLink(link) {
  if (!link) {
    return null;
  }
  if (link.sourceId) {
    const resource = liveSourceById.get(link.sourceId);
    if (!resource || !resource.ok) {
      return null;
    }
    return {
      label: link.label || resource.label,
      href: resource.finalUrl || resource.url,
      meta: resource.category,
      external: true,
    };
  }
  if (link.href && link.label) {
    return {
      label: link.label,
      href: link.href,
      meta: link.meta,
      external: /^https?:\/\//.test(link.href),
    };
  }
  return null;
}

function resolveLinks(links = []) {
  return links.map(resolveLink).filter(Boolean);
}

function nav(prefix = "") {
  const groups = siteData.navigation
    .map((group, index) => {
      const id = `nav-menu-${index}-${slugifyAnchor(group.label)}`;
      const items = (group.items || [])
        .map((item) => `<a href="${prefix}${escapeHtml(item.href)}" role="menuitem">${escapeHtml(item.label)}</a>`)
        .join("");
      return `<div class="nav-group">
        <button class="nav-menu-button" type="button" aria-expanded="false" aria-controls="${id}" data-nav-toggle>
          <span>${escapeHtml(group.label)}</span>
          <span aria-hidden="true">+</span>
        </button>
        <div class="nav-menu" id="${id}" role="menu">${items}</div>
      </div>`;
    })
    .join("");
  return `<nav class="nav" aria-label="Primary">${groups}</nav>`;
}

function socialLinks() {
  return siteData.social
    .map((item) => resolveLink(item))
    .filter(Boolean)
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("");
}

function actionButtons(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="hero-actions">${resolved
    .map((link, index) => {
      const kind = index === 0 ? "primary" : "secondary";
      return `<a class="button ${kind}" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`;
    })
    .join("")}</div>`;
}

function linkChips(links = []) {
  const resolved = resolveLinks(links);
  if (!resolved.length) {
    return "";
  }
  return `<div class="link-chips">${resolved
    .map((link) => {
      const meta = link.meta ? `<em>${escapeHtml(link.meta)}</em>` : "";
      return `<a href="${escapeHtml(link.href)}"><span>${escapeHtml(link.label)}</span>${meta}</a>`;
    })
    .join("")}</div>`;
}

function layout({ title, description, currentPath, body, bodyClass = "" }) {
  const prefix = relPrefix(currentPath);
  const pageTitle = title === siteData.site.name ? title : `${title} | ${siteData.site.name}`;
  const pageDescription = description || siteData.site.description;
  const canonicalUrl = absoluteUrl(currentPath);
  const normalizedBody = body.trim();
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
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="${prefix}assets/css/styles.css">
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
    ${normalizedBody}
  </main>
  <footer class="site-footer">
    <div>
      <strong>${escapeHtml(siteData.site.name)}</strong>
      <p>${escapeHtml(siteData.site.description)}</p>
    </div>
    <div class="footer-links">
      <a href="mailto:${escapeHtml(siteData.site.email)}">${escapeHtml(siteData.site.email)}</a>
      <a href="${prefix}resources.html">Resources</a>
      <a href="${prefix}get-involved.html">Get involved</a>
    </div>
    <div class="social-links" aria-label="Verified public links">
      ${socialLinks()}
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
        <a href="#key-surfaces">Key surfaces</a>
        <a href="#resources">Resources</a>
        <a href="#related-pages">Related pages</a>
      </nav>
    </div>
  </section>`;
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
  return `<div class="resource-grid compact-grid">${related
    .map(
      (relatedPage) => `<a class="resource-card internal-card" href="${slugToHref(relatedPage.slug)}">
        <span>${escapeHtml(relatedPage.audience || "Related guide")}</span>
        <strong>${escapeHtml(relatedPage.title)}</strong>
        <p>${escapeHtml(relatedPage.lede)}</p>
      </a>`,
    )
    .join("")}</div>`;
}

function resourcesForPage(page) {
  const groups = new Set(page.resourceGroups || []);
  const explicit = new Set(page.externalSourceIds || []);
  return (siteData.resources.resources || [])
    .filter((resource) => groups.has(resource.category) || explicit.has(resource.sourceId))
    .map(resolveResource)
    .filter(Boolean);
}

function resolveResource(resource) {
  const source = liveSourceById.get(resource.sourceId);
  if (!source || !source.ok) {
    return null;
  }
  const category = resourceCategoryById.get(resource.category);
  return {
    ...resource,
    source,
    categoryLabel: category?.label || source.category || resource.category,
    href: source.finalUrl || source.url,
  };
}

function resourceCards(resources = []) {
  if (!resources.length) {
    return '<p class="lede">No public resources are assigned here yet. Use the resource directory for the full verified list.</p>';
  }
  return `<div class="resource-grid">${resources
    .map((resource) => {
      const related = (resource.relatedSlugs || [])
        .map((slug) => pageBySlug.get(slug))
        .filter(Boolean)
        .map((page) => `<a href="${slugToHref(page.slug)}">${escapeHtml(page.title)}</a>`)
        .join("");
      const search = `${resource.source.label} ${resource.categoryLabel} ${resource.summary}`.toLowerCase();
      return `<article class="resource-card" data-category="${escapeHtml(resource.category)}" data-search="${escapeHtml(search)}">
        <span>${escapeHtml(resource.categoryLabel)}</span>
        <h3><a href="${escapeHtml(resource.href)}">${escapeHtml(resource.source.label)}</a></h3>
        <p>${escapeHtml(resource.summary)}</p>${related ? `\n        <div class="mini-links" aria-label="Related pages">${related}</div>` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function resourceSectionForPage(page) {
  return resourceCards(resourcesForPage(page));
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
  const programPage = siteData.pages.find((page) => page.slug === "programs");
  const projectPage = siteData.pages.find((page) => page.slug === "projects");
  const learningPage = siteData.pages.find((page) => page.slug === "learning");
  const ecosystemPage = siteData.pages.find((page) => page.slug === "ecosystem");
  const featuredResources = (siteData.resources.resources || [])
    .filter((resource) => resource.featured)
    .map(resolveResource)
    .filter(Boolean)
    .slice(0, 8);
  const body = `
  <section class="hero">
    <div class="hero-inner">
      <p class="eyebrow">Public resource hub</p>
      <h1>${escapeHtml(siteData.site.name)}</h1>
      <p class="hero-copy">${escapeHtml(siteData.site.description)}</p>
      ${actionButtons([
        { label: "Get involved", href: "get-involved.html" },
        { label: "Browse resources", href: "resources.html" },
        { label: "Explore projects", href: "projects.html" },
      ])}
    </div>
  </section>

  <section class="metrics-band" aria-label="Institute summary">
    ${siteData.metrics
      .map((metric) => `<div><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`)
      .join("")}
  </section>

  <section class="content-band">
    ${sectionHeading({
      eyebrow: "Start here",
      title: "Find the right path through the Institute",
      text: "The site is organized around what visitors need to do: understand the Institute, learn Active Inference, join activities, browse projects, and use verified public resources.",
    })}
    <div class="feature-layout">
      <article>
        <h3>Education, research, training, and applications</h3>
        <p>AII supports the Active Inference ecosystem through recurring learning groups, research projects, open-source work, media production, public events, partnerships, and institutional stewardship.</p>
        <p>Use the navigation groups to move quickly between institutional context, learning pathways, participation routes, project work, and public resources.</p>
      </article>
      <aside class="action-panel" aria-label="Recommended entry points">
        <a href="active-inference.html"><strong>Understand Active Inference</strong><span>Framework, applications, and entry points</span></a>
        <a href="learning.html"><strong>Start learning</strong><span>Readings, videos, podcasts, and groups</span></a>
        <a href="get-involved.html"><strong>Participate</strong><span>Channels, activities, support, and contact</span></a>
      </aside>
    </div>
  </section>

  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Core areas", title: "How the public work is organized" })}
    ${cardGrid([
      { title: "Institute", text: "Mission, structure, communications, values, governance, and public channels.", links: [{ label: "About", href: "about.html" }] },
      { title: "Programs", text: programPage.lede, links: [{ label: "Programs", href: "programs.html" }] },
      { title: "Projects", text: projectPage.lede, links: [{ label: "Projects", href: "projects.html" }] },
      { title: "Learning", text: learningPage.lede, links: [{ label: "Learning", href: "learning.html" }] },
      { title: "Ecosystem", text: ecosystemPage.lede, links: [{ label: "Ecosystem", href: "ecosystem.html" }] },
      { title: "Resources", text: "A searchable directory of verified community, learning, media, project, research, support, and social links.", links: [{ label: "Resource directory", href: "resources.html" }] },
    ])}
  </section>

  <section class="content-band">
    ${sectionHeading({ eyebrow: "Featured resources", title: "Verified public entry points", text: "These resources are checked through the public link registry and grouped by visitor need." })}
    ${resourceCards(featuredResources)}
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
    <p class="eyebrow">${escapeHtml(page.audience || "Public guide")}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.subtitle)}</p>
    ${actionButtons(page.primaryActions)}
  </section>
  ${pageGuide(page)}
  <section class="content-band">
    <p class="lede">${escapeHtml(page.lede)}</p>
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
  <section class="content-band muted" id="key-surfaces">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards)}
  </section>
  <section class="content-band" id="resources">
    ${sectionHeading({ eyebrow: "Verified resources", title: "Public links for this page", text: "External links are resolved from the shared resource registry so visitor-facing destinations stay centralized and checkable." })}
    ${resourceSectionForPage(page)}
  </section>
  <section class="content-band muted" id="related-pages">
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

function resourcesPage() {
  const categories = siteData.resources.categories || [];
  const resources = (siteData.resources.resources || []).map(resolveResource).filter(Boolean);
  const categoryOptions = categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`)
    .join("");
  const categoryNav = categories
    .map((category) => `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.label)}</a>`)
    .join("");
  const grouped = categories
    .map((category) => {
      const groupResources = resources.filter((resource) => resource.category === category.id);
      return `<section class="resource-category" id="${escapeHtml(category.id)}">
        ${sectionHeading({ eyebrow: "Resource group", title: category.label, text: category.description })}
        ${resourceCards(groupResources)}
      </section>`;
    })
    .join("");
  const body = `
  <section class="page-hero compact">
    <p class="eyebrow">Searchable directory</p>
    <h1>Resources</h1>
    <p>Find verified public links for community, learning, media, projects, research, support, and social channels.</p>
  </section>
  <section class="content-band page-index-band">
    <div class="resource-tools" aria-label="Resource filters">
      <label>
        <span>Search resources</span>
        <input id="resource-search" type="search" placeholder="Search Discord, YouTube, repositories, learning, support">
      </label>
      <label>
        <span>Filter group</span>
        <select id="resource-category">
          <option value="">All groups</option>
          ${categoryOptions}
        </select>
      </label>
      <p id="resource-count" class="result-count">${resources.length} resources shown</p>
    </div>
    <nav class="category-nav" aria-label="Resource groups">${categoryNav}</nav>
  </section>
  <section class="content-band">
    ${grouped}
  </section>`;
  return layout({
    title: "Resources",
    description: "Searchable directory of verified public Active Inference Institute resources.",
    currentPath: "resources.html",
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
  writeFile("resources.html", resourcesPage());
  writeFile(
    "404.html",
    layout({
      title: "Page not found",
      currentPath: "404.html",
      body: '<section class="page-hero compact"><p class="eyebrow">404</p><h1>Page not found</h1><p>Use the navigation or resource directory to return to the Institute website.</p><a class="button primary" href="index.html">Home</a></section>',
    }),
  );
  writeFile(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("sitemap.xml")}\n`,
  );
  const urls = [
    "index.html",
    ...siteData.pages.map((page) => `${page.slug}.html`),
    "resources.html",
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
