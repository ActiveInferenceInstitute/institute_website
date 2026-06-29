import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml, slugifyAnchor } from "../lib/text.mjs";
import { tr } from "../i18n/index.mjs";
import {
  siteData,
  pageBySlug,
} from "../data.mjs";
import {
  allResourceEntries,
  uniqueEntries,
  normalizedCuratedResources,
  normalizedOfficialPages,
  normalizedRepositories,
  entriesForPage,
} from "../lib/resources.mjs";
import { resolveLinks } from "./links.mjs";
import { actionButtons, linkChips, linkList } from "./page-sections.mjs";
import { sectionHeading, cardGrid, breadcrumb, pageGuide } from "./components.mjs";
import { publicPagePager } from "./pager.mjs";
import { resourceCards } from "./resources.mjs";
import { layout } from "./layout.mjs";
import { slugToHref, resolveInternalHref, relPrefix } from "./urls.mjs";
import { homeInstituteosGate, instituteosFeatureSections } from "./feature-sections.mjs";
import { autolinkInternal } from "./autolink.mjs";
import { knowledgePreview } from "./knowledge.mjs";
import { relatedProjectsSection } from "../pages/projects.mjs";

export function relatedSlugsForPage(page) {
  if (Array.isArray(page.relatedSlugs) && page.relatedSlugs.length) {
    return page.relatedSlugs;
  }
  const index = siteData.pages.findIndex((candidate) => candidate.slug === page.slug);
  return [siteData.pages[index - 1]?.slug, siteData.pages[index + 1]?.slug].filter(Boolean);
}

export function relatedPages(page, currentDir = "") {
  const related = relatedSlugsForPage(page).map((slug) => pageBySlug.get(slug)).filter(Boolean);
  return `<div class="resource-grid compact-grid">${related
    .map(
      (relatedPage) => `<a class="resource-card internal-card" href="${slugToHref(relatedPage.slug, currentDir)}">
        <span>${escapeHtml(tr(relatedPage.audience || "Related guide"))}</span>
        <strong>${escapeHtml(tr(relatedPage.title))}</strong>
        <p>${escapeHtml(tr(relatedPage.lede))}</p>
      </a>`,
    )
    .join("")}</div>`;
}

export function audiencePathwaySection(currentDir = "") {
  const pathways = siteData.audiencePathways.pathways || [];
  if (!pathways.length) {
    return "";
  }
  return `<section class="content-band" id="audience-pathways">
    ${sectionHeading({
      eyebrow: "Audience pathways",
      title: "Choose the next useful step",
      text: "These routes organize the same public resource map by visitor intent so people do not need to understand the whole Institute before finding a practical next action.",
    })}
    <div class="pathway-grid">
      ${pathways
        .map((pathway) => `<article class="pathway-card">
          <span>${escapeHtml(tr(pathway.label))}</span>
          <h3>${escapeHtml(tr(pathway.title || pathway.label))}</h3>
          <p>${escapeHtml(tr(pathway.summary))}</p>
          <a class="button secondary" href="${escapeHtml(resolveInternalHref(pathway.primaryHref, currentDir))}">${escapeHtml(tr(pathway.actionLabel || "Open pathway"))}</a>
          ${linkList(pathway.links, currentDir)}
        </article>`)
        .join("")}
    </div>
  </section>`;
}

export function bestNextActions(page, currentDir = "") {
  const primary = resolveLinks(page.primaryActions || []).slice(0, 3);
  const groups = page.resourceGroups || [];
  const related = relatedSlugsForPage(page)
    .map((slug) => pageBySlug.get(slug))
    .filter(Boolean)
    .slice(0, 2)
    .map((relatedPage) => ({
      label: tr(relatedPage.title),
      href: slugToHref(relatedPage.slug, currentDir),
    }));
  const resourceLinks = [
    groups[0]
      ? { label: tr("Filtered resources"), href: hrefForSlug("resources", currentDir, groups[0]) }
      : { label: tr("All resources"), href: hrefForSlug("resources", currentDir) },
    { label: tr("Global directory"), href: hrefForSlug("directory", currentDir) },
  ];
  const actions = [...primary, ...resourceLinks, ...related];
  return `<section class="content-band next-action-band" id="next-actions">
    <div class="next-action-panel">
      <div>
        <p class="eyebrow">${escapeHtml(tr("Best next actions"))}</p>
        <h2>${escapeHtml(tr(`${page.title} pathway`))}</h2>
        <p>${escapeHtml(tr("Start with the highest-signal public links for this page, then continue through the related resource and directory views."))}</p>
      </div>
      ${linkChips(actions, currentDir)}
    </div>
  </section>`;
}

export function homePage() {
  const currentDir = urlDirForSlug("index");
  const programPage = siteData.pages.find((page) => page.slug === "programs");
  const projectPage = siteData.pages.find((page) => page.slug === "projects");
  const learningPage = siteData.pages.find((page) => page.slug === "learning");
  const ecosystemPage = siteData.pages.find((page) => page.slug === "ecosystem");
  const instituteosPage = siteData.pages.find((page) => page.slug === "instituteos");
  const featuredResources = uniqueEntries(allResourceEntries().filter((resource) => resource.featured || resource.priority <= 12)).slice(0, 12);
  const body = `
  <section class="hero">
    <div class="hero-inner">
      <p class="eyebrow">${escapeHtml(tr("Comprehensive public resource hub"))}</p>
      <h1>${escapeHtml(siteData.site.name)}</h1>
      <p class="hero-copy">${escapeHtml(tr(siteData.site.description))}</p>
      ${actionButtons([
        { label: tr("Open global directory"), href: "directory.html" },
        { label: tr("Browse resources"), href: "resources.html" },
        { label: tr("Explore projects"), href: "projects.html" },
      ], currentDir)}
    </div>
  </section>

  <section class="metrics-band" aria-label="${escapeHtml(tr("Institute summary"))}">
    ${siteData.metrics
      .map((metric) => `<div><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(tr(metric.label))}</span></div>`)
      .join("")}
  </section>

  <section class="content-band">
    ${sectionHeading({
      eyebrow: "Start here",
      title: "Find the right path through the Institute",
      text: "The site indexes official Institute pages, public subdomains, learning and research references, channels, repositories, and participation routes.",
    })}
    <div class="feature-layout">
      <article>
        <h3>${escapeHtml(tr("Education, research, training, and applications"))}</h3>
        <p>${escapeHtml(tr("AII supports the Active Inference ecosystem through learning groups, research projects, open-source work, media production, public events, partnerships, and public collaboration pathways."))}</p>
        <p>${escapeHtml(tr("Use the directory when you need the complete map, or use the curated pages when you want guided pathways."))}</p>
      </article>
      <aside class="action-panel" aria-label="${escapeHtml(tr("Recommended entry points"))}">
        <a href="${hrefForSlug("directory", currentDir)}"><strong>${escapeHtml(tr("Global index"))}</strong><span>${escapeHtml(tr("Every page, resource, official link, and repository"))}</span></a>
        <a href="${hrefForSlug("resources", currentDir)}"><strong>${escapeHtml(tr("Filter resources"))}</strong><span>${escapeHtml(tr("Search by type, category, audience, and tag"))}</span></a>
        <a href="${hrefForSlug("knowledge", currentDir)}"><strong>${escapeHtml(tr("Open Source Map"))}</strong><span>${escapeHtml(tr("Public people, repositories, research, ideas, and ontology tables"))}</span></a>
        <a href="${hrefForSlug("instituteos", currentDir)}"><strong>${escapeHtml(tr("Public export gate"))}</strong><span>${escapeHtml(tr("How private docs and library records become public-safe website surfaces"))}</span></a>
        <a href="${hrefForSlug("get-involved", currentDir)}"><strong>${escapeHtml(tr("Participate"))}</strong><span>${escapeHtml(tr("Channels, activities, support, and contact"))}</span></a>
      </aside>
    </div>
  </section>

  ${audiencePathwaySection(currentDir)}
  ${homeInstituteosGate(currentDir)}

  <section class="content-band muted">
    ${sectionHeading({ eyebrow: "Core areas", title: "How the public work is organized" })}
    ${cardGrid([
      { title: "Institute", icon: "institute", text: "Mission, structure, communications, values, public channels, and visitor pathways.", links: [{ label: "About", href: "about.html" }, { label: "Official pages", href: "directory.html#official-pages" }] },
      { title: "Programs", icon: "programs", text: programPage.lede, links: [{ label: "Programs", href: "programs.html" }] },
      { title: "Projects", icon: "projects", text: projectPage.lede, links: [{ label: "Projects", href: "projects.html" }, { label: "Repositories", href: "directory.html#repositories" }] },
      { title: "Learning", icon: "learning", text: learningPage.lede, links: [{ label: "Learning", href: "learning.html" }, { label: "Learning resources", href: "resources.html#learning" }] },
      { title: "Ecosystem", icon: "ecosystem", text: ecosystemPage.lede, links: [{ label: "Ecosystem", href: "ecosystem.html" }] },
      { title: "InstituteOS Interface", icon: "resources", text: instituteosPage.lede, links: [{ label: "Export gate", href: "instituteos.html" }, { label: "Open Source Map", href: "knowledge.html" }] },
      { title: "Open Source Map", icon: "map", text: "Structured public tables for people, repositories, research links, ideas, and ontology relationships.", links: [{ label: "Open Source Map", href: "knowledge.html" }] },
      { title: "Directory", icon: "directory", text: "A complete global index of public pages, resource groups, repositories, and verified external links.", links: [{ label: "Global directory", href: "directory.html" }] },
    ], currentDir)}
  </section>

  <section class="content-band">
    ${sectionHeading({ eyebrow: "Featured resources", title: "Verified public entry points", text: "These resources are checked through the public link registry and grouped by visitor need." })}
    ${resourceCards(featuredResources, { filterable: false, currentDir })}
  </section>`;
  return layout({
    title: siteData.site.name,
    currentDir,
    description: siteData.site.description,
    body,
    bodyClass: "home",
    slug: "index",
  });
}

export function publicPage(page) {
  const currentDir = urlDirForSlug(page.slug);
  const curated = normalizedCuratedResources();
  const official = normalizedOfficialPages();
  const repositories = normalizedRepositories();
  const body = `
  <section class="page-hero compact">
    ${breadcrumb(page, currentDir)}
    <p class="eyebrow">${escapeHtml(tr(page.audience || "Public guide"))}</p>
    <h1>${escapeHtml(tr(page.title))}</h1>
    <p>${escapeHtml(tr(page.subtitle))}</p>
    ${actionButtons(page.primaryActions, currentDir)}
  </section>
  ${pageGuide(page, currentDir)}
  ${bestNextActions(page, currentDir)}
  <section class="content-band">
    <p class="lede">${escapeHtml(tr(page.lede))}</p>
    <div class="article-stack">
      ${page.sections
        .map((section) => {
          const links = linkChips(section.links, currentDir);
          const chips = links ? `\n            ${links}` : "";
          const heading = `<h2>${escapeHtml(tr(section.heading))}</h2>`;
          const para = `<p>${autolinkInternal(escapeHtml(tr(section.body)), currentDir)}</p>`;
          // The DOM id stays English-stable (anchors must match across locales);
          // only the visible heading and body are translated.
          if (section.image && section.image.src) {
            const alt = (section.image.alt && tr(section.image.alt)) || tr(section.heading);
            const img = `<img class="article-figure" src="${escapeHtml(relPrefix(currentDir) + section.image.src)}" alt="${escapeHtml(alt)}" width="${Number(section.image.width) || 600}" height="${Number(section.image.height) || 600}" loading="lazy" decoding="async">`;
            return `<article class="article-block has-figure" id="${escapeHtml(slugifyAnchor(section.heading))}">
            ${img}
            <div class="article-figure-body">${heading}
            ${para}${chips}</div>
          </article>`;
          }
          return `<article class="article-block" id="${escapeHtml(slugifyAnchor(section.heading))}">
            ${heading}
            ${para}${chips}
          </article>`;
        })
        .join("")}
    </div>
  </section>
  ${instituteosFeatureSections(page, currentDir)}
  <section class="content-band muted" id="key-surfaces">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards, currentDir)}
  </section>
  ${page.slug.startsWith("project-") ? relatedProjectsSection(page, currentDir) : ""}
  ${knowledgePreview(page, currentDir)}
  <section class="content-band" id="resources">
    ${sectionHeading({ eyebrow: "Related resources", title: "Public links for this page", text: "External links are resolved from the shared registry so visitor-facing destinations stay centralized and checkable." })}
    ${resourceCards(entriesForPage(page, curated, 12), { currentDir })}
  </section>
  <section class="content-band muted" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute surfaces" })}
    ${resourceCards(entriesForPage(page, official, 8), { compact: true, currentDir })}
  </section>
  <section class="content-band" id="repositories">
    ${sectionHeading({ eyebrow: "Repositories", title: "Related open-source repositories" })}
    ${resourceCards(entriesForPage(page, repositories, page.slug === "projects" ? 16 : 8), { compact: true, currentDir })}
    <p class="section-link"><a href="${hrefForSlug("directory", currentDir, "repositories")}">${escapeHtml(tr("View all {n} public repositories").replace("{n}", siteData.repositories.repositories.length))}</a></p>
  </section>
  <section class="content-band muted" id="related-pages">
    ${sectionHeading({ eyebrow: "Related pages", title: "Continue through the site" })}
    ${relatedPages(page, currentDir)}
  </section>
  ${publicPagePager(page, currentDir)}`;
  return layout({
    title: page.title,
    description: page.lede,
    currentDir,
    body,
    slug: page.slug,
  });
}
