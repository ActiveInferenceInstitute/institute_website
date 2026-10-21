# Domain Cutover (complete)

The Squarespace to GitHub Pages migration is complete. Hosting and DNS state
reported by the administrator on 2026-10-12 is recorded in
[Migration and redirects](../../../../docs/MIGRATION_AND_REDIRECTS.md#base-url-and-custom-domain).

- Apex A records: `185.199.108.153` through `185.199.111.153`.
- Apex AAAA records: `2606:50c0:8000::153` through `2606:50c0:8003::153`.
- `www` CNAME: `activeinferenceinstitute.github.io`, redirecting to the apex.
- Pages: `main` at `/`; custom domain `activeinference.institute`; Enforce HTTPS on.
- DNS: Squarespace Domains, with Squarespace/NS1 authoritative servers.
- Verification record: `_github-pages-challenge-ActiveInferenceInstitute`.

DNS and registrar forwarding changes remain administrator actions. For repo
changes, edit source, run `npm run build` and `npm run check`, then commit source
and generated output together. `check:site` requires HTTPS and CNAME/baseUrl
host agreement. `check:redirects` pins the on-site forwarding destinations.

Legacy apex paths now have build-generated static redirect stubs; the generated
404 script remains a fallback. Follow [EditRedirects](EditRedirects.md).
