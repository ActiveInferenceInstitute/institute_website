import { siteData, EXPORTED_AT } from "../data.mjs";
import { absoluteUrl } from "./urls.mjs";

export function buildManifest() {
  return (
    JSON.stringify(
      {
        name: siteData.site.name,
        short_name: "AII",
        description: siteData.site.description,
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        icons: [
          { src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "assets/img/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}

export function buildSecurityTxt() {
  // Derive Expires from the export date (+1 year) so it stays deterministic with
  // the rest of the build and never silently lapses against a stale hardcoded date.
  const base = EXPORTED_AT ? new Date(EXPORTED_AT) : null;
  const expires =
    base && !Number.isNaN(base.getTime())
      ? new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : "2027-06-19T00:00:00.000Z";
  return [
    `Contact: mailto:${siteData.site.email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${absoluteUrl(".well-known/security.txt")}`,
    "",
  ].join("\n");
}
