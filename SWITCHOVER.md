# Switchover handoff — Squarespace → GitHub Pages

Executive handoff for moving `activeinference.institute` from Squarespace to this
static GitHub Pages site. For the detailed redirect map and the per-subdomain
repoint table, see [`MIGRATION.md`](MIGRATION.md). For how the build works, see
[`AGENTS.md`](AGENTS.md) and the agent skill at
`.claude/skills/institute-website/SKILL.md`.

## Status at a glance

| Layer | State |
| --- | --- |
| Apex page-URL redirects | ✅ Built & verified (in local commit, not pushed) |
| New canonical domain (apex) | ✅ Staged: `CNAME` + `baseUrl` flipped, site rebuilt |
| Shortlink coverage audit + gap pages | ✅ Done (9 new pages + roster/aicacp) |
| Documentation & agent navigability | ✅ This pass |
| Build/check gates | ✅ Pass (one unrelated external item — see Known issues) |
| **Push to `origin`** | 🔴 Human — not done (intentionally) |
| **DNS cutover** | 🔴 Human — not done |
| **GitHub Pages custom-domain enable** | 🔴 Human — not done |
| **Repoint subdomain forwards** | 🔴 Human — do at your pace post-cutover |
| **Gap-page content** | 🟡 Needs your information (pages exist; see MIGRATION.md §4) |

Everything below marked ✅ is in the **local checkpoint commit** (`git log -1`).
Nothing has been pushed; the live site is unchanged.

---

## ✅ What is done (in the repo, local only)

1. **Apex URL redirects.** `assets/js/redirects.js` maps 34 legacy Squarespace
   paths (`/fellowship`, `/tnb`, `/board-of-directors`, `/about-us`, `/courses`,
   …) to new clean URLs. Loaded only on `404.html` (GitHub Pages' catch-all);
   unmatched paths show the informative 404. Base-path aware, case-insensitive,
   verified by simulation.
2. **Canonical domain flipped to apex.** `CNAME` = `activeinference.institute`;
   `src/content/site.json` `baseUrl` = `https://activeinference.institute/`.
   Rebuilt → all canonicals, `hreflang`, sitemap, Open Graph, and the redirect
   script reference now use the apex domain.
3. **Shortlink coverage closed.** All ~38 subdomain forwards audited. 9 new
   on-site pages created for topics that previously lived only on Coda
   (`/strategy/`, `/measure/`, `/prepare/`, `/video/`, `/weekly/`, `/2025/`,
   `/2026/`, `/projects/affordances/`, `/projects/wave-hypothesis/`), plus
   Board/SAB roster links on `/structure/` and a deepened `/projects/aicacp/`.
   5 new sources registered in `live-sources.json`.
4. **Checks made domain-aware.** `check_site_contract.py` and
   `check_internal_links.py` now read the canonical base from `site.json`, so the
   gates pass before and after cutover with no edits.
5. **Documentation & agent navigability** (this pass): root docs refreshed, a
   documentation map, per-folder `AGENTS.md`, page-type templates, and an
   invokable `.claude/skills/institute-website` skill.

## 🟡 What I can still do (just ask)

- Add the gap-page content once you provide the specifics in `MIGRATION.md §4`
  (strategy priorities, annual goals/events, rosters, research detail, etc.).
- Drive the Board/SAB rosters or the ontology terms from the InstituteOS data
  export instead of linking out (the data is in the repo).
- Run `npm run sync:instituteos` to clear the entities drift (see Known issues).
- Prepare per-subdomain forward changes as a copy-paste list for your registrar.
- Split the local checkpoint into cleaner commits if you want to separate the
  in-progress i18n work from the migration before pushing.

## 🔴 What needs a human

These require registrar/GitHub account access or your knowledge — I cannot do them.

### 1. Push the commit
Review the local checkpoint, then `git push origin main` **only when you are
ready to cut over** (push makes the `CNAME` live to GitHub Pages).

### 2. DNS — point the apex at GitHub Pages
In the DNS provider that currently hosts `activeinference.institute` (Squarespace
domains / your registrar), set the apex (`@`) records:

**A records (required):**
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
**AAAA records (optional, IPv6):**
```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```
**`www` subdomain → CNAME →** `activeinferenceinstitute.github.io`

> **Do not delete the existing subdomain forwarding rules** (`eduactive.`,
> `fellows.`, `structure.`, …). They are separate hosts and must keep working
> through the cutover. You are only changing the apex `@` (and `www`) records.

### 3. Enable the custom domain in GitHub Pages
Repo → Settings → Pages → Custom domain → `activeinference.institute` → Save →
wait for the certificate → check **Enforce HTTPS**. (Pushing the `CNAME` file
usually sets this automatically.)

### 4. Repoint subdomain forwards (at your pace, post-cutover)
Per the table in `MIGRATION.md §2`: 20 can point at on-site pages now, 5 stay
external, 13 point at the new gap pages (which link onward to Coda until you fill
them in). Nothing breaks if you leave them on Coda.

### 5. Provide gap-page content
`MIGRATION.md §4` lists exactly what each new page still needs.

---

## Cutover sequence (recommended order)

1. Review the local commit; rebuild if you changed anything (`node src/build.mjs`).
2. `git push origin main`.
3. Confirm the GitHub Pages build is green and the site renders at
   `activeinferenceinstitute.github.io` (it will redirect once the domain is set).
4. Set the DNS A/AAAA + `www` records (step 2 above).
5. Enable the custom domain + Enforce HTTPS (step 3).
6. Wait for DNS propagation (minutes–hours) and certificate issuance.
7. Run the verification checklist below.
8. Repoint subdomain forwards (step 4) whenever you like.

## Post-cutover verification checklist

- [ ] `https://activeinference.institute/` loads the new home page over HTTPS.
- [ ] `https://www.activeinference.institute/` redirects to the apex.
- [ ] A legacy path redirects: `https://activeinference.institute/fellowship`
      → `/programs/fellowship/`; `/tnb` → `/projects/theoretical-neurobiology/`.
- [ ] An unknown path (`/this-does-not-exist`) shows the informative 404.
- [ ] A new gap page loads: `https://activeinference.institute/strategy/`.
- [ ] A subdomain forward still works: `https://fellows.activeinference.institute`.
- [ ] `https://activeinference.institute/sitemap.xml` lists apex URLs.

## Rollback

The cutover is reversible at the DNS layer: restore the previous apex A records
(or re-enable Squarespace serving) and remove the GitHub Pages custom domain. The
repo changes are a single local commit; `git reset --soft HEAD~1` unwinds them
before any push.

## Known issues (not migration-caused)

- **`check:instituteos` reports `entities.json` stale.** The parent InstituteOS
  repo's `library/registries/entities.json` drifted mid-session; it is unrelated
  to the migration and touches none of the migrated files. Run
  `npm run sync:instituteos` separately (it re-derives the public-safe snapshot
  through the PII gate) if you want a fully green `npm run check`.
- **In-progress i18n work** was already uncommitted in the working tree before
  this migration; the local checkpoint bundles it so a fresh checkout stays
  build-consistent. Reorganize commits before pushing if you want it separated.
