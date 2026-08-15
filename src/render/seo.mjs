import fs from "node:fs";
import path from "node:path";
import { loadProjectsData, pageBySlug, siteData } from "../data.mjs";
import { out } from "../lib/paths.mjs";
import { outputPathForSlug, urlDirForSlug, stripLocalePrefix, localeOutputPathForSlug } from "../url-taxonomy.mjs";
import { tr } from "../i18n/index.mjs";
import { resolveLink } from "./links.mjs";
import { absoluteUrl } from "./urls.mjs";

// Absolute URLs for the 1200x630 social-share card and the square logo/icon.
export const OG_IMAGE = () => absoluteUrl("assets/img/social-card.png");
export const LOGO_IMAGE = () => absoluteUrl("assets/img/icon-512.png");

// Per-page social card: assets/img/cards/<slug>.png when present on disk, else the
// shared social-card.png. Cards are generated for src/content/pages slugs (and any
// other slug whose card has been rasterized); programmatic pages without a card
// (knowledge, directory, resources, search, home) fall back to the shared card.
export function ogImageForSlug(slug) {
  if (slug) {
    const cardFile = path.join("assets", "img", "cards", `${slug}.png`);
    if (fs.existsSync(out(cardFile))) {
      return absoluteUrl(cardFile);
    }
  }
  return OG_IMAGE();
}

export function jsonLdScript(data) {
  // Non-executable schema.org data block. Escape "<" so a "</script>" inside any
  // value cannot break out of the element (the security gate allows ld+json).
  return `\n  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

// Resolve the public code-repository URL for a project page, if any. Reads the
// public data/projects.json links map (github / github_main / any github.com URL).
// Returns null when the project has no associated public repository.
export function projectRepositoryUrl(websiteSlug) {
  const project = (loadProjectsData().projects || []).find((entry) => entry.website_slug === websiteSlug);
  if (!project) {
    return null;
  }
  if (typeof project.repository_url === "string" && project.repository_url.trim()) {
    return project.repository_url.trim();
  }
  const links = project.links || {};
  for (const key of ["github", "github_main", "repository", "repo"]) {
    if (typeof links[key] === "string" && links[key].includes("github.com")) {
      return links[key];
    }
  }
  for (const value of Object.values(links)) {
    if (typeof value === "string" && value.includes("github.com")) {
      return value;
    }
  }
  return null;
}

// schema.org node for a /projects/<name>/ page. SoftwareSourceCode when a public
// code repository is known, otherwise CreativeWork. Only page-derived fields are
// used (title, description, canonical url) — nothing is fabricated.
export function projectStructuredNode(slug, rawTitle, canonicalUrl, description) {
  const repoUrl = projectRepositoryUrl(slug);
  const node = {
    "@type": repoUrl ? "SoftwareSourceCode" : "CreativeWork",
    "@id": `${canonicalUrl}#project`,
    name: rawTitle,
    url: canonicalUrl,
  };
  if (description) {
    node.description = description;
  }
  if (repoUrl) {
    node.codeRepository = repoUrl;
  }
  return node;
}

// schema.org CollectionPage + ItemList for an index/hub page (/projects/,
// /programs/). Enumerates the child pages that route under <currentDir>/ in the
// same order siteData.pages is already sorted. Every URL is derived via
// absoluteUrl — no hardcoded literals — keeping the external-URL gate green.
export function collectionStructuredNode(currentDir, canonicalUrl, rawTitle, description) {
  const childPages = siteData.pages.filter((p) => {
    const dir = urlDirForSlug(p.slug);
    return dir !== currentDir && dir.startsWith(`${currentDir}/`);
  });
  const itemListElement = childPages.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.title,
    url: absoluteUrl(outputPathForSlug(p.slug)),
  }));
  const itemList = {
    "@type": "ItemList",
    "@id": `${canonicalUrl}#itemlist`,
    name: rawTitle,
    numberOfItems: itemListElement.length,
    itemListElement,
  };
  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: rawTitle,
    url: canonicalUrl,
    ...(description ? { description } : {}),
    isPartOf: { "@id": `${absoluteUrl("index.html")}#website` },
    mainEntity: { "@id": `${canonicalUrl}#itemlist` },
  };
  return [collectionPage, itemList];
}

// schema.org Course node for a project page that carries a `syllabus` block
// (e.g. the physics and social-sciences courses). Emits an educational offering
// with the provider pinned to the brand Organization. All URLs derive from
// page data via absoluteUrl — no hardcoded literal URLs, so the security/contract
// gates stay green.
export function courseStructuredNode(slug, rawTitle, canonicalUrl, description, syllabus, lang = "") {
  const course = {
    "@type": "Course",
    "@id": `${canonicalUrl}#course`,
    name: rawTitle,
    url: canonicalUrl,
    provider: { "@id": `${absoluteUrl("index.html")}#org` },
  };
  if (lang) course.inLanguage = lang;
  if (description) course.description = description;
  const items = Array.isArray(syllabus.items) ? syllabus.items : [];
  if (items.length) {
    course.hasCourseInstance = {
      "@type": "CourseInstance",
      isAccessibleForFree: true,
      courseMode: "online",
      name: syllabus.heading || rawTitle,
      courseWorkload: `PT${items.length}H`,
      offers: {
        "@type": "Offer",
        category: "Free",
        price: "0",
        priceCurrency: "USD",
      },
    };
  }
  return course;
}

// schema.org FAQPage node from a page's `qanda` block (question/body pairs).
// Only populated when there is at least one real Q&A item. Google restricts FAQ
// rich results to certain authoritative sites, but the markup remains valid
// schema and can surface as enhanced/answer snippets.
export function faqStructuredNode(canonicalUrl, qanda) {
  const items = Array.isArray(qanda.items) ? qanda.items.filter((i) => i && i.title && i.body) : [];
  if (!items.length) return null;
  return {
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.title,
      acceptedAnswer: { "@type": "Answer", text: item.body },
    })),
  };
}

export function structuredData(rawTitle, currentDir, canonicalUrl, slug = "", description = "", minimalSeo = false, lang = "") {
  const base = absoluteUrl("index.html");
  // Soft-error pages (404) carry no entity markup and must not seed the graph.
  if (minimalSeo) {
    return "";
  }
  // sameAs consolidates the brand's Knowledge Graph entity. Derived at build time
  // from the same verified live-sources path the footer uses — no hardcoded URLs.
  const sameAs = siteData.social.map(resolveLink).filter((l) => l && l.external && l.href).map((l) => l.href);
  const orgNode = {
    "@type": "Organization",
    "@id": `${base}#org`,
    // The Institute is a 501(c)(3) nonprofit (src/content/metrics.json); the NGO
    // additionalType strengthens the Knowledge Graph entity. Purely additive.
    additionalType: "https://schema.org/NGO",
    name: siteData.site.name,
    url: base,
    logo: LOGO_IMAGE(),
    description: siteData.site.description,
    email: siteData.site.email,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "general inquiries",
      email: siteData.site.email,
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
  if (!currentDir) {
    return jsonLdScript({
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "WebSite",
          "@id": `${base}#website`,
          url: base,
          name: siteData.site.name,
          publisher: { "@id": `${base}#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("search/index.html")}?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    });
  }
  // The Home crumb points to the CURRENT locale's home, and section structure is
  // read from the locale-agnostic base dir so a locale prefix is not mistaken for
  // a section. Section crumb URLs are resolved through the locale-aware taxonomy.
  const localeHome = absoluteUrl(localeOutputPathForSlug("index"));
  const items = [{ "@type": "ListItem", position: 1, name: "Home", item: localeHome }];
  const parts = stripLocalePrefix(currentDir).split("/").filter(Boolean);
  let position = 2;
  if (parts.length === 2) {
    const section = parts[0];
    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
    items.push({
      "@type": "ListItem",
      position: position++,
      name: tr(sectionLabel),
      item: absoluteUrl(localeOutputPathForSlug(section)),
    });
  }
  items.push({ "@type": "ListItem", position, name: rawTitle, item: canonicalUrl });
  const breadcrumb = { "@type": "BreadcrumbList", "@id": `${canonicalUrl}#breadcrumb`, itemListElement: items };
  // On project pages, merge a SoftwareSourceCode/CreativeWork node into a single
  // @graph alongside the breadcrumb. Other pages keep the lone BreadcrumbList.
  if (slug.startsWith("project-")) {
    const graph = [breadcrumb, projectStructuredNode(slug, rawTitle, canonicalUrl, description), orgNode];
    const page = pageBySlug.get(slug);
    if (page && page.syllabus) {
      graph.push(courseStructuredNode(slug, rawTitle, canonicalUrl, description, page.syllabus, lang));
    }
    const faq = page && page.qanda ? faqStructuredNode(canonicalUrl, page.qanda) : null;
    if (faq) graph.push(faq);
    return jsonLdScript({ "@context": "https://schema.org", "@graph": graph });
  }
  // Index/collection hubs (/projects/, /programs/) additionally publish a
  // CollectionPage + ItemList of their child pages so crawlers see the listing.
  // Exact-equality on currentDir guarantees only the hub matches — detail pages
  // have currentDir like "projects/<name>" and keep their project node above.
  if (stripLocalePrefix(currentDir) === "projects" || stripLocalePrefix(currentDir) === "programs") {
    return jsonLdScript({
      "@context": "https://schema.org",
      "@graph": [breadcrumb, ...collectionStructuredNode(currentDir, canonicalUrl, rawTitle, description), orgNode],
    });
  }
  // Inner pages carry the breadcrumb plus a brand Organization reference so the
  // entity (and its sameAs) reaches crawlers entering via deep pages.
  return jsonLdScript({ "@context": "https://schema.org", "@graph": [breadcrumb, orgNode] });
}

// Search-snippet-safe meta description: collapse whitespace and clip to ~157
// chars on a word boundary so SERPs don't truncate mid-word. The full lede
// still renders in the visible page body — this only trims the <meta> value.
export function metaDescription(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= 160) {
    return s;
  }
  return s.slice(0, 157).replace(/\s+\S*$/, "") + "…";
}
