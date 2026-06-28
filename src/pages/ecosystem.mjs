import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { siteData } from "../data.mjs";
import { escapeHtml, sanitizePublicProse, slugifyAnchor } from "../lib/text.mjs";
import { tr } from "../i18n/index.mjs";
import { slugToHref } from "../render/urls.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";
import { projectPageSlugForDataId } from "./projects.mjs";

// "Browse projects by domain" — cross-links each domain's projects to the
// generated project pages (where a public page exists for that project).
export function domainProjectsSection(currentDir = "") {
  const domains = (siteData.instituteos.domainProjects.domains || []).filter((domain) => (domain.projects || []).length);
  if (!domains.length) {
    return "";
  }
  const slugToPage = new Set(siteData.pages.map((page) => page.slug));
  const cards = domains
    .map((domain) => {
      const links = (domain.projects || [])
        .map((project) => {
          const pageSlug = projectPageSlugForDataId(project.id);
          const label = escapeHtml(sanitizePublicProse(project.title || project.id));
          if (pageSlug && slugToPage.has(pageSlug)) {
            return `<a href="${slugToHref(pageSlug, currentDir)}">${label}</a>`;
          }
          return `<span>${label}</span>`;
        })
        .join("");
      const domainHref = slugToHref(`ecosystem/${domain.slug}`, currentDir);
      return `<article class="info-card domain-card" id="${escapeHtml(slugifyAnchor(`domain-${domain.slug}`))}">
        <h3><a href="${domainHref}">${escapeHtml(sanitizePublicProse(domain.domain))}</a></h3>
        <p>${(domain.projects || []).length} public project${(domain.projects || []).length === 1 ? "" : "s"} mapped to this domain of application.</p>
        <div class="mini-links">${links}</div>
      </article>`;
    })
    .join("");
  return `<section class="content-band" id="browse-by-domain">
    ${sectionHeading({
      eyebrow: "Browse by domain",
      title: "Projects across domains of application",
      text: "Each domain of application links to the public project pages that work within it. Projects can appear in more than one domain.",
    })}
    <div class="card-grid">${cards}</div>
  </section>`;
}

// Per-domain ecosystem landing pages (/ecosystem/<domain>/). One page per
// domain that has mapped projects, listing each project as an internal link
// (when a real page exists) or a plain article (when it does not). Emitted
// programmatically via slugRenderers — NOT added to siteData.pages, so it is
// not subject to the curated-page contract. All links are CSP-safe internal
// hrefs; layout() supplies CSP/canonical/nav/footer.
export function ecosystemDomainPages() {
  const domains = (siteData.instituteos.domainProjects.domains || []).filter((domain) => (domain.projects || []).length);
  const slugToPage = new Set(siteData.pages.map((page) => page.slug));
  // Return a lazy renderer per page (not pre-rendered HTML): the build calls
  // render() once per locale, so currentDir, internal links, asset prefixes, and
  // the language switcher all resolve under the active locale. Rendering eagerly
  // here would bake the default locale's paths into every locale tree.
  return domains.map((domain) => {
    const routedSlug = `ecosystem/${domain.slug}`;
    const domainName = sanitizePublicProse(domain.domain);
    const count = (domain.projects || []).length;
    const render = () => {
      const currentDir = urlDirForSlug(routedSlug);
      const cards = (domain.projects || [])
        .map((project) => {
          const pageSlug = projectPageSlugForDataId(project.id);
          const label = escapeHtml(sanitizePublicProse(project.title || project.id));
          if (pageSlug && slugToPage.has(pageSlug)) {
            return `<a class="resource-card internal-card" href="${slugToHref(pageSlug, currentDir)}"><strong>${label}</strong></a>`;
          }
          return `<article class="resource-card"><strong>${label}</strong></article>`;
        })
        .join("");
      const countLine = tr(`{n} public projects mapped to the {domain} domain of application.`)
        .replace("{n}", count)
        .replace("{domain}", escapeHtml(domainName));
      const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="${escapeHtml(tr("Breadcrumb"))}"><a href="${hrefForSlug("index", currentDir)}">${escapeHtml(tr("Home"))}</a><span aria-hidden="true">/</span><a href="${hrefForSlug("ecosystem", currentDir)}">${escapeHtml(tr("Ecosystem"))}</a><span aria-hidden="true">/</span><span>${escapeHtml(domainName)}</span></nav>
    <p class="eyebrow">${escapeHtml(tr("Domain of application"))}</p>
    <h1>${escapeHtml(domainName)}</h1>
    <p>${countLine}</p>
  </section>
  <section class="content-band" id="domain-projects">
    ${sectionHeading({ eyebrow: "Projects", title: `Projects in ${domainName}` })}
    <div class="resource-grid">${cards}</div>
    <p class="mini-links"><a href="${hrefForSlug("ecosystem", currentDir)}">${escapeHtml(tr("Back to the ecosystem overview"))}</a></p>
  </section>`;
      return layout({
        title: domainName,
        description: `Public Active Inference Institute projects in the ${domainName} domain of application.`,
        currentDir,
        body,
        slug: routedSlug,
      });
    };
    return { slug: routedSlug, render };
  });
}
