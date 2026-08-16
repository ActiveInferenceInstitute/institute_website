import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, slugifyAnchor } from "../lib/text.mjs";
import { tr } from "../i18n/index.mjs";
import { slugToHref } from "../render/urls.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";
import { narrativesForTarget } from "../render/narrative.mjs";
import { autolinkInternal } from "../render/autolink.mjs";
import { projectPageSlugForDataId } from "./projects.mjs";

// The narrative section that carries per-topic ecosystem prose. Every narrative
// filed under it becomes a topic of its own rather than another block of text
// stacked on the ecosystem overview.
export const TOPIC_NARRATIVE_SECTION = "domains-of-application";

// Ecosystem topics, keyed by slug, merged from the two backend sources that
// describe the same thing from different angles:
//   * narratives_public.json — the prose for a domain of application
//   * domain_projects.json   — the public projects mapped to that domain
// A topic needs only one of the two to earn a page; when both exist they render
// on the same page, which is why the slug (not the source) is the identity.
export function ecosystemTopics() {
  const topics = new Map();
  const upsert = (name, patch) => {
    const title = sanitizePublicProse(name || "");
    const slug = slugifyAnchor(title);
    if (!slug) {
      return;
    }
    const existing = topics.get(slug) || { slug, title, projects: [], html: "" };
    topics.set(slug, { ...existing, ...patch, slug, title: existing.title || title });
  };
  for (const entry of narrativesForTarget("ecosystem")) {
    if (entry.section === TOPIC_NARRATIVE_SECTION) {
      upsert(entry.title, { html: entry.html });
    }
  }
  for (const domain of siteData.instituteos.domainProjects.domains || []) {
    if ((domain.projects || []).length) {
      upsert(domain.domain, { projects: domain.projects });
    }
  }
  return [...topics.values()].sort((a, b) => a.title.localeCompare(b.title));
}

// Project links for one topic: an internal link when the project has a public
// page, plain text otherwise (the external-anchor gate forbids raw hrefs here).
function projectLinks(projects, currentDir, cardClass = "") {
  const slugToPage = new Set(siteData.pages.map((page) => page.slug));
  return (projects || [])
    .map((project) => {
      const pageSlug = projectPageSlugForDataId(project.id);
      const label = escapeHtml(sanitizePublicProse(project.title || project.id));
      if (!cardClass) {
        return pageSlug && slugToPage.has(pageSlug)
          ? `<a href="${slugToHref(pageSlug, currentDir)}">${label}</a>`
          : `<span>${label}</span>`;
      }
      return pageSlug && slugToPage.has(pageSlug)
        ? `<a class="${cardClass} internal-card" href="${slugToHref(pageSlug, currentDir)}"><strong>${label}</strong></a>`
        : `<article class="${cardClass}"><strong>${label}</strong></article>`;
    })
    .join("");
}

// "Browse the ecosystem by topic" — one card per topic, each card's heading a
// link out to that topic's own page. Replaces the previous behaviour of dumping
// every domain narrative inline on /ecosystem/ with no way to link to one.
export function ecosystemTopicsSection(currentDir = "") {
  const topics = ecosystemTopics();
  if (!topics.length) {
    return "";
  }
  const cards = topics
    .map((topic) => {
      const href = slugToHref(`ecosystem/${topic.slug}`, currentDir);
      const count = topic.projects.length;
      const projectLine = count
        ? `<p>${count} public project${count === 1 ? "" : "s"} mapped to this topic.</p>`
        : "";
      return `<article class="info-card domain-card" id="${escapeHtml(slugifyAnchor(`topic-${topic.slug}`))}">
        <h3><a href="${href}">${escapeHtml(topic.title)}</a></h3>
        ${projectLine}
        <div class="mini-links">${projectLinks(topic.projects, currentDir)}</div>
      </article>`;
    })
    .join("");
  return `<section class="content-band" id="browse-by-domain">
    ${sectionHeading({
      eyebrow: "Browse by topic",
      title: "Topics across the Active Inference ecosystem",
      text: "Each topic has its own page with the Institute's public narrative for that area and the public projects mapped to it. Projects can appear under more than one topic.",
    })}
    <div class="card-grid">${cards}</div>
  </section>`;
}

// Per-topic ecosystem pages (/ecosystem/<topic>/). Emitted programmatically via
// slugRenderers — NOT added to siteData.pages, so they are not subject to the
// curated-page contract. All links are CSP-safe internal hrefs; layout() supplies
// CSP/canonical/nav/footer.
export function ecosystemTopicPages() {
  const topics = ecosystemTopics();
  // Return a lazy renderer per page (not pre-rendered HTML): the build calls
  // render() once per locale, so currentDir, internal links, asset prefixes, and
  // the language switcher all resolve under the active locale. Rendering eagerly
  // here would bake the default locale's paths into every locale tree.
  return topics.map((topic) => {
    const routedSlug = `ecosystem/${topic.slug}`;
    const render = () => {
      const currentDir = urlDirForSlug(routedSlug);
      const count = topic.projects.length;
      const countLine = count
        ? tr(`{n} public projects mapped to the {domain} domain of application.`)
            .replace("{n}", count)
            .replace("{domain}", escapeHtml(topic.title))
        : escapeHtml(tr("Public Institute narrative for this area of the Active Inference ecosystem."));
      const narrativeBand = topic.html
        ? `<section class="content-band" id="topic-narrative">
    ${sectionHeading({ eyebrow: "Ecosystem", title: `About ${topic.title}` })}
    <div class="article-stack"><article class="article-block">${autolinkInternal(topic.html, currentDir)}</article></div>
  </section>`
        : "";
      const projectsBand = count
        ? `<section class="content-band" id="domain-projects">
    ${sectionHeading({ eyebrow: "Projects", title: `Projects in ${topic.title}` })}
    <div class="resource-grid">${projectLinks(topic.projects, currentDir, "resource-card")}</div>
  </section>`
        : "";
      const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="${escapeHtml(tr("Breadcrumb"))}"><a href="${hrefForSlug("index", currentDir)}">${escapeHtml(tr("Home"))}</a><span aria-hidden="true">/</span><a href="${hrefForSlug("ecosystem", currentDir)}">${escapeHtml(tr("Ecosystem"))}</a><span aria-hidden="true">/</span><span>${escapeHtml(topic.title)}</span></nav>
    <p class="eyebrow">${escapeHtml(tr("Domain of application"))}</p>
    <h1>${escapeHtml(topic.title)}</h1>
    <p>${countLine}</p>
  </section>
  ${narrativeBand}
  ${projectsBand}
  <section class="content-band muted" id="topic-related">
    <p class="mini-links"><a href="${hrefForSlug("ecosystem", currentDir)}">${escapeHtml(tr("Back to the ecosystem overview"))}</a></p>
  </section>`;
      return layout({
        title: topic.title,
        description: `Public Active Inference Institute narrative and projects for the ${topic.title} topic in the Active Inference ecosystem.`,
        currentDir,
        body,
        slug: routedSlug,
      });
    };
    return { slug: routedSlug, render };
  });
}
