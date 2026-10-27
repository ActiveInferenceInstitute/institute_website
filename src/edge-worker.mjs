import { createRedirectHandler } from "./http-redirects.mjs";
import redirects from "../data/redirects.json" with { type: "json" };
import site from "./content/site.json" with { type: "json" };

/** Cloudflare Workers Static Assets adapter; no proxy back to the custom-domain origin. */
export function createAssetWorker(entries, canonicalBase) {
  const redirect = createRedirectHandler(entries, canonicalBase);
  const host = new URL(canonicalBase).host;
  return {
    async fetch(request, env) {
      if (![host, `www.${host}`].includes(new URL(request.url).host)) {
        return new Response("Host not served by this website", { status: 404 });
      }
      const response = redirect(request);
      if (response) return response;
      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") throw new TypeError("Static Assets binding is required");
      return env.ASSETS.fetch(request);
    },
  };
}

export default createAssetWorker(redirects, site.baseUrl);
