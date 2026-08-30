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
import { renderNarrativeBody } from "./narrative.mjs";
import { publicPagePager } from "./pager.mjs";
import { resourceCards } from "./resources.mjs";
import { layout } from "./layout.mjs";
import { domainsSection } from "./domains.mjs";
import { slugToHref, resolveInternalHref, relPrefix } from "./urls.mjs";
import { homeInstituteosGate, instituteosFeatureSections } from "./feature-sections.mjs";
import { autolinkInternal } from "./autolink.mjs";
import { knowledgePreview } from "./knowledge.mjs";
import {
  relatedProjectsSection,
  projectCatalogSection,
  syllabusGrid,
  qaGrid,
  projectStatusForSlug,
  projectLeadForSlug,
} from "../pages/projects.mjs";
import { programCatalogSection } from "../pages/programs.mjs";

// Homepage stat cards. Two of the five metrics are derivable from the live
// content catalogs; computing them here keeps the homepage in sync with the
// Directory (which computes the same counts), instead of drifting from the
// static values in src/content/metrics.json. Community/recording counts are
// not derivable from any catalog and stay static.
function homeMetrics() {
  const derived = {
    "verified public links": String(allResourceEntries().length),
    "public repositories indexed": String(normalizedRepositories().length),
  };
  return siteData.metrics.map((metric) => ({
    value: derived[metric.label] || metric.value,
    label: metric.label,
  }));
}

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
      // The card says where the link goes, not everything waiting there. It used
      // to carry the destination's full audience sentence AND its full lede, so
      // every project page repeated the same three paragraphs for Projects,
      // ReInference, and Ecosystem — 16% of a project page's words were these
      // cards. The subtitle is the one-line description each page already writes
      // for exactly this purpose.
      (relatedPage) => `<a class="resource-card internal-card" href="${slugToHref(relatedPage.slug, currentDir)}">
        <strong>${escapeHtml(tr(relatedPage.title))}</strong>
        <p>${escapeHtml(tr(relatedPage.subtitle || relatedPage.lede))}</p>
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
        <h2>${escapeHtml(tr("Where to go next"))}</h2>
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
    ${homeMetrics()
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
  </section>
  ${domainsSection(currentDir)}`;
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
  // Detail pages should point to their own evidence first.  Broad category
  // fallback remains useful for top-level guides, but it makes project and
  // domain pages repeat the same global catalog at the bottom of every page.
  const isDetailPage = page.slug.startsWith("project-") || page.slug.startsWith("active-inference-and-");
  const curatedEntries = entriesForPage(page, curated, 12, { fallbackToCategory: !isDetailPage });
  const officialEntries = entriesForPage(page, official, 8, { fallbackToCategory: false });
  const repositoryEntries = entriesForPage(page, repositories, page.slug === "projects" ? 16 : 8, {
    fallbackToCategory: false,
  });
  const hasKeySurfaces = Array.isArray(page.cards) && page.cards.length > 0;
  const surfaceIds = [
    hasKeySurfaces ? "key-surfaces" : "",
    curatedEntries.length ? "resources" : "",
    officialEntries.length ? "official-pages" : "",
    repositoryEntries.length ? "repositories" : "",
    "related-pages",
  ].filter(Boolean);
  // Every project detail page (slug "project-*") surfaces its registry status
  // here, not only on the /projects/ catalog card, so a visitor landing
  // directly on an archived project's page (search engine, shared link,
  // sitemap, related-projects card) is told before reading a "how to
  // participate" section written while the project was still active.
  const isArchivedProject = page.slug.startsWith("project-") && projectStatusForSlug(page.slug) === "archived";
  // Built as a standalone string (not an inline ternary on its own template
  // line) so non-project and active-project pages get byte-identical hero
  // markup to before this notice existed -- no stray blank line from a
  // false-branch "" sitting on its own line.
  const archivedProjectNotice = isArchivedProject
    ? `\n    <p class="mt-notice status-notice" role="note"><span aria-hidden="true">📦</span> ${escapeHtml(tr("This project is archived. It is no longer active, and any participation prompts below describe how it previously operated."))}</p>`
    : "";
  // Project lead, from the registry. The catalog card on /projects/ already
  // showed "Lead: <name>" while the project's own page named nobody; both now
  // read the same field, so they cannot drift. Built as a standalone string for
  // the same reason as the notice above — pages without a lead keep byte-identical
  // hero markup.
  const projectLead = page.slug.startsWith("project-") ? projectLeadForSlug(page.slug) : "";
  const projectLeadLine = projectLead
    ? `\n    <p class="project-lead">${escapeHtml(tr("Lead"))}: ${escapeHtml(projectLead)}</p>`
    : "";
  const body = `
  <section class="page-hero compact">
    ${breadcrumb(page, currentDir)}
    <p class="eyebrow">${escapeHtml(tr(page.audience || "Public guide"))}</p>
    <h1>${escapeHtml(tr(page.title))}</h1>
    <p>${escapeHtml(tr(page.subtitle))}</p>${projectLeadLine}${archivedProjectNotice}
    ${actionButtons(page.primaryActions, currentDir)}
  </section>
  ${pageGuide(page, currentDir, surfaceIds)}
  ${page.syllabus ? syllabusGrid(page.syllabus, currentDir) : ""}
  <section class="content-band">
    <p class="lede">${escapeHtml(tr(page.lede))}</p>
    <div class="article-stack">
      ${page.sections
        .map((section) => {
          const links = linkChips(section.links, currentDir);
          const chips = links ? `\n            ${links}` : "";
          const heading = `<h2>${escapeHtml(tr(section.heading))}</h2>`;
          const para = autolinkInternal(renderNarrativeBody(tr(section.body)), currentDir);
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
  ${bestNextActions(page, currentDir)}
  ${page.slug === "projects" ? projectCatalogSection(currentDir) : ""}
  ${page.slug === "programs" ? programCatalogSection(currentDir) : ""}
  ${instituteosFeatureSections(page, currentDir)}
  ${hasKeySurfaces ? `<section class="content-band muted" id="key-surfaces">
    ${sectionHeading({ eyebrow: "Key surfaces", title: `${page.title} at a glance` })}
    ${cardGrid(page.cards, currentDir)}
  </section>` : ""}
  ${page.slug.startsWith("project-") ? relatedProjectsSection(page, currentDir) : ""}
  ${knowledgePreview(page, currentDir)}
  ${page.qanda ? qaGrid(page.qanda, currentDir) : ""}
  ${curatedEntries.length ? `<section class="content-band" id="resources">
    ${sectionHeading({ eyebrow: "Related resources", title: "Public links for this page" })}
    ${resourceCards(curatedEntries, { currentDir })}
  </section>` : ""}
  ${officialEntries.length ? `<section class="content-band muted" id="official-pages">
    ${sectionHeading({ eyebrow: "Official pages", title: "Official Institute surfaces" })}
    ${resourceCards(officialEntries, { compact: true, currentDir })}
  </section>` : ""}
  ${repositoryEntries.length ? `<section class="content-band" id="repositories">
    ${sectionHeading({ eyebrow: "Repositories", title: "Related open-source repositories" })}
    ${resourceCards(repositoryEntries, { compact: true, currentDir })}
    <p class="section-link"><a href="${hrefForSlug("directory", currentDir, "repositories")}">${escapeHtml(tr("View all {n} public repositories").replace("{n}", siteData.repositories.repositories.length))}</a></p>
  </section>` : ""}
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
