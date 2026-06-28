# Squarespace → GitHub Pages migration runbook

This document covers switching `activeinference.institute` from Squarespace to
this static site, so that existing links keep working. There are three moving
parts:

1. **Apex page URLs** (`activeinference.institute/<path>`) — old Squarespace
   pages are mapped to their new locations by a client-side redirect that runs on
   the 404 page. No server config needed.
2. **Subdomain shortlinks** (`<name>.activeinference.institute`) — these are
   registrar/DNS URL forwards, independent of where the apex site is hosted. They
   keep working through the cutover and can be repointed from Coda to new on-site
   pages on your own schedule.
3. **The hosting cutover itself** — a `CNAME` file plus a one-line base-URL
   change, then DNS.

---

## 1. Apex URL redirects (automatic)

GitHub Pages has no server-side redirects, so legacy Squarespace paths are
handled by [`assets/js/redirects.js`](assets/js/redirects.js), which is loaded
**only** on [`404.html`](404.html). GitHub Pages serves `404.html` for any path
that does not resolve to a built file, so every unmatched request runs the
script. If the path matches a legacy URL it `location.replace()`s to the new
page; otherwise the normal, informative 404 is shown.

The script is base-path aware (works on the apex domain and on the
`/institute_website/` project-page base) and matches case-insensitively, with or
without a trailing slash.

| Old Squarespace path | Redirects to |
| --- | --- |
| `/home` | `/` |
| `/history`, `/about-us` | `/about/` |
| `/board-of-directors`, `/officers` | `/structure/` |
| `/scientific-advisory-board` | `/structure/` |
| `/courses`, `/education` | `/learning/` |
| `/research-overview` | `/learning/` |
| `/livestreams` | `/activities/` |
| `/physics-as-information-processing`, `/paip1` | `/ecosystem/physics/` |
| `/participation` | `/get-involved/` |
| `/fellowship` | `/programs/fellowship/` |
| `/internship` | `/programs/internship/` |
| `/partnership` | `/programs/partnership/` |
| `/donate`, `/support` | `/programs/philanthropy/` |
| `/active-blockference`, `/active-blockference-1` | `/projects/active-blockference/` |
| `/knowledge-engineering` | `/projects/knowledge-engineering/` |
| `/rxinfer` | `/projects/rxinfer/` |
| `/symposium` | `/projects/symposium/` |
| `/textbook-group` | `/projects/textbook-group/` |
| `/theoretical-neurobiology-group`, `/theoretical-neurobiology-group-1`, `/tnb` | `/projects/theoretical-neurobiology/` |

Anything not in the table (for example the stray Squarespace `/new-page`) falls
through to the informative 404. To add or change a mapping, edit the `MAP` object
in `assets/js/redirects.js` — no rebuild required for that file, but run
`npm run check` to validate.

---

## 2. Subdomain shortlinks (repoint at your own pace)

These are DNS-level forwards configured at the registrar, not part of this repo.
They keep working unchanged through the cutover. The table below records, for
each, whether the new site can already host the destination so you can repoint
the forward off Coda.

### Ready to repoint now → on-site pages

The new site has substantive equivalent pages; point the forward at the on-site
URL (prefix with `https://activeinference.institute`).

| Subdomain(s) | New target |
| --- | --- |
| `eduactive` | `/eduactive/` |
| `activities`, `projects` | `/projects/` |
| `ecosystem` | `/ecosystem/` |
| `structure` | `/structure/` |
| `reinference` | `/reinference/` |
| `volunteer` | `/volunteer/` |
| `intern` | `/programs/internship/` |
| `mentorship` | `/programs/mentorship/` |
| `fellows`, `fellowship` | `/programs/fellowship/` |
| `partnerships`, `partnership` | `/programs/partnership/` |
| `welcome` | `/get-involved/` |
| `textbook-group` | `/projects/textbook-group/` |
| `rxinfer` | `/projects/rxinfer/` |
| `knowledge-engineering` | `/projects/knowledge-engineering/` |
| `active-blockference` | `/projects/active-blockference/` |
| `symposium` | `/projects/symposium/` |
| `tnb` | `/projects/theoretical-neurobiology/` |

### Keep as external forwards

Launch policy: **no shortlink may point at the old Coda workspace.** A shortlink
whose current destination is already off-platform stays on that off-platform
destination (unchanged); every shortlink currently pointing at Coda is repointed
to the new on-site page (the two tables above and below).

| Subdomain | Keep pointing at |
| --- | --- |
| `newsletter` | Substack (`https://activeinferenceinstitute.substack.com/`) |
| `chat` | Perplexity search |
| `obsidian` | Obsidian publish knowledge base (surfaced on `/active-inference/`) |
| `resnei` | Zenodo record (`https://zenodo.org/records/15389683`) |
| `zoom` | Zoom meeting room |
| `start` | GitHub Start repo (`https://github.com/ActiveInferenceInstitute/Start/`) |
| `donate`, `paypal`, `support` | PayPal (`https://www.paypal.com/donate/?hosted_button_id=XZK68Z2CJKWF8`) |
| `discord` | Discord invite (`https://discord.gg/FSUvYD2p9S`) |

### Repoint to a new on-site page (full materials still being migrated)

These topics now have a **dedicated on-site page** created during this migration.
Each page gives an accurate overview and links onward to the topic's own
shortlink (the registered live source) for the complete materials that still
live on Coda. You can repoint the forward at the on-site page now — every link
keeps working, and the "Full materials" link on each page carries visitors to
the authoritative Coda doc until that content is migrated in. The specific
information still needed per page is listed in section 4.

| Subdomain | New on-site page | Status of on-site content |
| --- | --- | --- |
| `strategy` | `/strategy/` | Mission/motto/units framing; current priorities link to hub |
| `measure` | `/measure/` | Lifecycle + update/reporting framing; metrics/templates on hub |
| `prepare` | `/prepare/` | Onboarding-pathway framing; proposal steps/templates on hub |
| `affordances` | `/projects/affordances/` | Research-thread framing; full materials on hub |
| `wave-hypothesis` | `/projects/wave-hypothesis/` | Research-thread framing; hypothesis detail on hub |
| `video` | `/video/` | Library overview + YouTube link; full catalogue on hub |
| `weekly` | `/weekly/` | Weekly-cadence framing; live schedule on hub + Calendar |
| `2025` | `/2025/` | Annual-overview framing; goals/milestones/record on hub |
| `2026` | `/2026/` | Annual-overview framing; plan/calendar on hub |
| `aicacp` | `/projects/aicacp/` | Deepened; detailed docs link to hub |
| `ontology` | `/projects/active-inference-ontology/` | Overview + repo/hub links to machine-readable terms |
| `sab` | `/structure/#scientific-advisory-board` | Role description + live-roster link to `sab` hub |
| `bod` | `/structure/#board-of-directors` | Role description + live-roster link to `bod` hub |

---

## 3. Hosting cutover steps

In order:

1. **Add the custom domain to the repo.** Create a `CNAME` file at the repo root
   containing exactly:

   ```
   activeinference.institute
   ```

2. **Switch the base URL.** In [`src/content/site.json`](src/content/site.json)
   set:

   ```json
   "baseUrl": "https://activeinference.institute/"
   ```

   Then rebuild: `node src/build.mjs`. This updates every canonical URL,
   `hreflang` alternate, sitemap entry, Open Graph URL, and the redirect-script
   reference (which becomes `/assets/js/redirects.js`, base `/`). Run
   `npm run check` to validate.

3. **Point DNS at GitHub Pages** (at the registrar that currently hosts the
   Squarespace forwards). For the apex domain, create the four GitHub Pages
   `A` records (185.199.108–111.153) and an `AAAA`/`ALIAS` as documented by
   GitHub, plus a `www` `CNAME` to `activeinferenceinstitute.github.io`. This is
   the only step that actually moves traffic off Squarespace.

4. **Enable the custom domain in GitHub Pages settings** and enable *Enforce
   HTTPS* once the certificate provisions.

5. **Leave the subdomain forwards alone** during the cutover — they are separate
   DNS hosts and are unaffected. Repoint them per section 2 whenever you like.

> The apex redirect map and the base-aware redirect script already work at both
> bases, so the redirect behavior is correct before and after the `baseUrl`
> flip — the flip only changes canonical/sitemap URLs and the absolute script
> path.

---

## 4. Information still needed (to fully replace Coda)

Each topic above now has a real on-site page, so nothing blocks the cutover. The
pages are written honestly from public framing and end with a "Full materials"
link to the Coda hub. To finish migrating each topic **off** Coda, the following
specific information needs to be provided and added to the page — these are the
parts that should not be invented:

- **`/strategy/`** — the Institute's current strategic priorities, focus areas,
  and plans.
- **`/measure/`** — the measurement framework: the specific metrics tracked, the
  update/reporting cadence, and the reporting templates.
- **`/prepare/`** — the concrete project-preparation steps, proposal template,
  and readiness checklist.
- **`/projects/affordances/`** and **`/projects/wave-hypothesis/`** — the actual
  research content (scope, claims, references) for each thread.
- **`/video/`** — the curated list of videos & podcasts (beyond the YouTube
  channel link).
- **`/weekly/`** — the live weekly schedule (which sessions run when).
- **`/2025/`** and **`/2026/`** — the annual goals, milestones, and event record
  / calendar for each year.
- **`/projects/aicacp/`** — the detailed AICACP program documentation.
- **`/structure/` (Board & SAB)** — the named current Board and Scientific
  Advisory Board rosters. The InstituteOS `entities.json` export already carries
  governance roles and could drive these lists once confirmed current; for now
  each section links to the live `bod` / `sab` roster.
- **`/projects/active-inference-ontology/`** — optionally render the
  machine-readable ontology terms (already in the InstituteOS export /
  repository) directly on the page instead of linking out.

Until a topic's information is added, its "Full materials" link keeps carrying
visitors to the authoritative Coda doc — so every link works either way.
