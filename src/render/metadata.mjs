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
        id: "./",
        icons: [
          // Per W3C guidance, one icon entry declares exactly one purpose, so
          // each PNG size is listed twice: once as a regular icon ("any") and
          // once as a maskable icon for Android adaptive launchers (the PNG art
          // has generous safe-zone padding, verified visually).
          { src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
  // the rest of the build. When EXPORTED_AT is missing or invalid there is no
  // trustworthy expiry, so the Expires line is OMITTED rather than publishing a
  // stale hardcoded date (an expired security.txt is treated as stale by
  // consumers; a magic future date just silently lapses).
  const base = EXPORTED_AT ? new Date(EXPORTED_AT) : null;
  const expires =
    base && !Number.isNaN(base.getTime())
      ? new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  return [
    `Contact: mailto:${siteData.site.email}`,
    ...(expires ? [`Expires: ${expires}`] : []),
    "Preferred-Languages: en",
    `Canonical: ${absoluteUrl(".well-known/security.txt")}`,
    "",
  ].join("\n");
}
