# Optional HTTP redirect boundary

GitHub Pages cannot execute the Fetch handler. The prepared
[Workers adapter](../src/edge-worker.mjs) uses the generated redirect map and a
Cloudflare Static Assets binding. Assets must be staged from reviewed public
output, never the repository root. Serving assets directly avoids a loop through
GitHub Pages' custom-domain redirects.

The [example configuration](wrangler.toml.example) has no active host bindings.
Copy it into private operator configuration and set both `main` to the adapter
path and `assets.directory` to the staged public artifact
only after the provider/zone and apex/www binding plan is approved. It does not
claim an existing Cloudflare account, zone or deployment. Other subdomains stay
with their current forwarding owners.

Unknown paths retain the assets service's 404. Non-GET/HEAD methods pass through.
Known aliases and scheme/host normalization use HTTP 308, preserving the query
and browser fragment inheritance. Rollback removes only the two new bindings
and restores the prior apex/www records; retain the GitHub Pages site and the
current registrar forwarding inventory throughout migration.

See [routing operations](../docs/MIGRATION_AND_REDIRECTS.md) and the
[follow-up report](../docs/INDEXING_FOLLOWUP.md).
