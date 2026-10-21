// Identity is established only by registered sources supplied by the caller.
// No network access, registry globals, or raw citation href fallbacks.
export function normalizeDoi(value) {
  if (typeof value !== "string") return null;
  let doi;
  try {
    doi = decodeURIComponent(value.trim());
  } catch {
    return null;
  }
  return /^10\.\d{4,9}\/[^\s<>"\\\u0000-\u001f\u007f]+$/u.test(doi) ? doi.toLowerCase() : null;
}

export function registeredHttpUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function doiFromUrl(value) {
  const url = registeredHttpUrl(value);
  if (!url || url.hostname !== "doi.org" || url.port || url.search || url.hash) return null;
  return normalizeDoi(url.pathname.slice(1));
}

export function resolveCitationSource(citation, sources) {
  const byId = sources instanceof Map ? sources : new Map(sources.map((source) => [source.id, source]));
  const hasDoi = Boolean(citation.doi);
  const doi = normalizeDoi(citation.doi);
  if (hasDoi && !doi) return null;
  for (const id of citation.sourceIds || []) {
    const source = byId.get(id);
    if (!source || source.id !== id || source.ok !== true || source.promoted === false) continue;
    const url = registeredHttpUrl(source.url);
    if (!url) continue;
    if (!hasDoi) return source;
    // A DOI resolver URL must identify this DOI even if metadata says otherwise.
    if (url.hostname === "doi.org") {
      if (doiFromUrl(source.url) === doi) return source;
      continue;
    }
    const prefix = `citation-${citation.id}`;
    if ((id === prefix || id.startsWith(`${prefix}-`)) && normalizeDoi(source.doi) === doi) return source;
  }
  return null;
}
