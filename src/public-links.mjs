import fs from "node:fs";
import { siteData } from "./data.mjs";
import { activeLocale, DEFAULT_LOCALE } from "./i18n/index.mjs";

const { forwards } = JSON.parse(fs.readFileSync(new URL("./content/inbound-forwards.json", import.meta.url), "utf8"));
const instituteHost = (host) => /(^|\.)activeinference\.(institute|org)$/.test(host);
const deadHosts = new Set(["measure.activeinference.org", "onboard.activeinference.org", "octopus.activeinference.institute"]);
const secureProfileHosts = new Set(["adeelrazi.org", "faculty.washington.edu", "jakubsmekal.com", "www.sandeepramesh.com", "alvaradolab.com", "crowdsmart.ai"]);

export function normalizePublicUrl(value) {
  const raw = String(value || "");
  if (!/^https?:\/\//i.test(raw)) return raw;
  const url = new URL(raw);
  if (deadHosts.has(url.hostname)) return "";
  if (instituteHost(url.hostname) || secureProfileHosts.has(url.hostname)) url.protocol = "https:";
  if (url.hostname === "www.activeinference.institute") url.hostname = "activeinference.institute";
  const apex = new URL(siteData.site.baseUrl);
  const subdomain = url.hostname.endsWith(`.${apex.hostname}`) ? url.hostname.slice(0, -apex.hostname.length - 1) : "";
  if (forwards[subdomain] && url.pathname === "/") {
    url.hostname = apex.hostname;
    url.pathname = forwards[subdomain];
  }
  if (url.hostname === apex.hostname) {
    if (!url.pathname.endsWith("/") && !url.pathname.split("/").at(-1).includes(".")) url.pathname += "/";
    const locale = activeLocale();
    const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
    return `${prefix}${url.pathname}${url.search}${url.hash}`;
  }
  return raw.replace(/^http:/i, url.protocol === "https:" ? "https:" : "http:");
}

export function normalizePublicAnchors(html) {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (anchor, label) => {
    const match = anchor.match(/\bhref="([^"]*)"/i);
    if (!match) return anchor;
    const href = normalizePublicUrl(match[1]);
    if (!href) return label;
    let result = anchor.replace(match[0], `href="${href}"`);
    if (href.startsWith("/")) result = result.replace(/\s+(?:target|rel)="[^"]*"/gi, "");
    return result;
  });
}
