# Edit a legacy-URL redirect

1. Edit `redirects.map`, `redirects.prefix` or `redirects.set` in
   [url-taxonomy.json](../../../../src/url-taxonomy.json). MAP aliases are
   English-only; PREFIX and SET renames apply across every locale. Structural
   rules must agree with the routing rules in the same file.
2. Confirm each destination is a real built page. A real route takes precedence
   over an alias; stubs must never overwrite existing visitor content.
3. Run `npm run build`. It emits canonical, noindex, meta-refresh stubs with
   visible fallback links, the generated `assets/js/redirects.js`, and
   `data/redirects.json`. Localized simulation aliases retain their filenames
   and point to the root simulation files.
4. Run `npm run check`. The redirect gate independently enumerates expected
   source paths and checks destination existence, canonical/refresh/fallback,
   noindex, runtime parity, inbound destinations and shortlink rendering.
5. Commit the taxonomy and generated output together.

Do not edit the generated script. Its browser logic is in
[redirect-runtime.js](../../../../src/redirect-runtime.js). Static stubs return
HTTP 200 on Pages; they are HTML redirects, not HTTP 301 responses. Unknown
paths still receive the informative 404 and the fallback script.

Registrar forwarding is administered outside this repository. On-site forwards
are recorded in [inbound-forwards.json](../../../../src/content/inbound-forwards.json);
the build generates the corresponding table in
[Migration and redirects](../../../../docs/MIGRATION_AND_REDIRECTS.md).
