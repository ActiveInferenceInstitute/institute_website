# Changelog

All notable changes to the Active Inference Institute website are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## v2.0.0 — 2026-06-19

Major information-architecture change: the website now uses clean,
section-based URLs.

### Changed
- **Clean URLs everywhere.** Every page now lives at a readable directory path
  instead of a `.html` file. For example, the About page is now at `/about/`
  (previously `/about.html`), projects live under `/projects/<name>/`, and the
  participation programs live under `/programs/<name>/` (fellowship, internship,
  mentorship, partnership, philanthropy). The home page is `/` and the global
  index is `/directory/`.
- All internal links, navigation, the sitemap, and canonical URLs were updated
  to the new clean paths.

### Notes
- This is a hard URL break with no redirect stubs: old `*.html` addresses are no
  longer emitted. Update any external bookmarks to the new section URLs.
- The custom 404 page remains at the site root so it keeps working on
  GitHub Pages.

## v1.0.0 — 2026-06-19

First versioned release of the public website.

### Added
- **Interactive network graphs** — explore the Active Inference tech tree, the
  concept/ontology relationships, and the Institute's governance network as
  navigable node-link diagrams.
- **Narrative content** surfaced across the About, Activities, Structure, and
  Ecosystem pages (mission, history, strategy, and domains of application).
- **Browse projects by domain** on the Ecosystem page, with related-project
  cross-links throughout the project pages.
- **Open Source Map** tables for public people, repositories, ideas, ontology
  relationships, governance, processes, and policies.
- A machine-readable `version.json` and an on-page build stamp for provenance.

### Notes
- The site is a static, dependency-free build with a strict Content Security
  Policy. All public data is generated from a curated, privacy-reviewed source.
