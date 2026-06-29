# Switchover handoff — historical note

The Squarespace → GitHub Pages switchover is **complete**. `activeinference.institute`
is served by this static GitHub Pages site at the apex domain (`CNAME` +
`src/content/site.json` `baseUrl`), with legacy URLs handled by the redirect
machinery.

This was the one-time executive handoff document; its status checklist is now fully
done. For current operations:

- **Redirect architecture & SEO infrastructure**:
  [`docs/MIGRATION_AND_REDIRECTS.md`](docs/MIGRATION_AND_REDIRECTS.md).
- **Build, gates, and deployment**: [`docs/README.md`](docs/README.md) and
  [`AGENTS.md`](AGENTS.md).
- **Original handoff content**: preserved in git history (`git log -- SWITCHOVER.md`).
