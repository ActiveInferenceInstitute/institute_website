import { siteData, typeById, categoryById, audienceById } from "../data.mjs";
import { sourceFor, publicHrefForSource } from "../render/links.mjs";

export function recordMatchesPage(record, page) {
  const groups = new Set(page.resourceGroups || []);
  return (
    (record.relatedSlugs || []).includes(page.slug) ||
    groups.has(record.category) ||
    (page.externalSourceIds || []).includes(record.sourceId)
  );
}

export function normalizedCuratedResources() {
  return (siteData.resources.resources || [])
    .filter((resource) => resource.promoted !== false)
    .map((resource) => normalizeResource(resource, "resource"))
    .filter(Boolean);
}

export function normalizedOfficialPages() {
  return (siteData.officialPages.pages || [])
    .filter((item) => item.promoted !== false)
    .map((item) => normalizeResource(item, "official"))
    .filter(Boolean);
}

export function normalizedRepositories() {
  return (siteData.repositories.repositories || [])
    .filter((item) => item.promoted !== false)
    .map((item) => normalizeResource(item, "repository"))
    .filter(Boolean);
}

export function allResourceEntries() {
  return [...normalizedCuratedResources(), ...normalizedOfficialPages(), ...normalizedRepositories()].sort(
    (a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || a.label.localeCompare(b.label),
  );
}

export function uniqueEntries(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.sourceId || entry.href;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function normalizeResource(resource, sourceKind) {
  const source = sourceFor(resource.sourceId);
  if (!source) {
    return null;
  }
  const type = resource.type || sourceKind;
  const category = resource.category || "community";
  const audience = resource.audience || "newcomer";
  const tags = resource.tags || [];
  return {
    ...resource,
    source,
    sourceKind,
    type,
    typeLabel: typeById.get(type)?.label || type,
    category,
    categoryLabel: categoryById.get(category)?.label || source.category || category,
    audience,
    audienceLabel: audienceById.get(audience)?.label || audience,
    tags,
    label: resource.title || resource.name || source.label,
    href: publicHrefForSource(source),
    summary: resource.summary || resource.description || source.label,
  };
}

export function entriesForPage(page, entries, limit = 8) {
  return entries.filter((entry) => recordMatchesPage(entry, page)).slice(0, limit);
}
