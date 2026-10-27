// Optional Fetch-compatible edge/server boundary. GitHub Pages cannot run this;
// an operator must bind it ahead of Pages before it supplies HTTP redirects.
// Feed the generated data/redirects.json, never a second hand-maintained map.
export function createRedirectHandler(entries, canonicalBase) {
  const base = new URL(canonicalBase);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
    throw new TypeError("Redirect origin must be a credential-free HTTPS root URL");
  }
  const keyFor = path => path.replace(/^\/+|\/+$/g, "").replace(/\.html?$/i, "").toLowerCase();
  const routes = new Map();
  for (const { from, to } of entries) {
    if (typeof from !== "string" || typeof to !== "string" || from.startsWith("/") || to.startsWith("/") || /[?#\\]/.test(from + to)) {
      throw new TypeError("Legacy paths must be relative paths without query, fragment or backslash");
    }
    const destination = new URL(to, base);
    const source = new URL(from, base);
    if (destination.origin !== base.origin || destination.pathname !== "/" + to || source.origin !== base.origin || source.pathname !== "/" + from) {
      throw new TypeError("Legacy paths must stay on the canonical origin without traversal");
    }
    const key = keyFor(from);
    if (routes.has(key) && routes.get(key) !== destination.pathname) throw new TypeError("Conflicting legacy redirect");
    routes.set(key, destination.pathname);
  }
  for (const [from, to] of routes) {
    if (routes.has(keyFor(to))) throw new TypeError(`Legacy redirect loop or chain: ${from}`);
  }
  return function redirect(request) {
    if (!["GET", "HEAD"].includes(request.method)) return null;
    const incoming = new URL(request.url);
    if (![base.host, `www.${base.host}`].includes(incoming.host)) return null;
    let path;
    try { path = decodeURIComponent(incoming.pathname); }
    catch { return null; }
    const target = routes.get(keyFor(path));
    const destination = new URL(incoming.pathname, base);
    if (target !== undefined) destination.pathname = target;
    destination.search = incoming.search;
    // Browser fragments do not reach an HTTP server; Location without a fragment
    // allows clients to inherit the original fragment under the HTTP contract.
    if (destination.href === incoming.href) return null;
    return new Response(null, { status: 308, headers: { Location: destination.href } });
  };
}
