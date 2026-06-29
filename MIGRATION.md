# Migration — historical note

The Squarespace → GitHub Pages cutover is **complete**. The site is served at the
canonical apex domain `https://activeinference.institute/` (`CNAME` +
`src/content/site.json` `baseUrl`).

This file was the one-time migration runbook. It has been retired now that the
cutover is done:

- **Active redirect architecture** (how legacy URLs are handled, the redirect map,
  SEO/canonical/sitemap behaviour): see
  [`docs/MIGRATION_AND_REDIRECTS.md`](docs/MIGRATION_AND_REDIRECTS.md).
- **Load-bearing redirect machinery** (do not remove): `assets/js/redirects.js`
  (legacy-path map), `404.html` (GitHub Pages catch-all that loads it), `CNAME`,
  `robots.txt`.
- **Full original runbook and migration decisions**: preserved in git history
  (`git log -- MIGRATION.md`).
