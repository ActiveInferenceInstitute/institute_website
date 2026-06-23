# Contributing

Thanks for helping improve the **Active Inference Institute** public website. This
is the source for the site published at
[activeinference.institute](https://activeinference.institute). Whether you spotted
a typo, a broken link, an out-of-date fact, or you have an idea for a new section,
there are two easy ways to reach us.

## 1. Open a GitHub issue

The fastest way to report a problem or suggest a change is a GitHub issue on this
repository:

- **New issue:** <https://github.com/ActiveInferenceInstitute/institute_website/issues/new>
- **Browse existing issues:** <https://github.com/ActiveInferenceInstitute/institute_website/issues>

Before opening a new issue, a quick search of the existing issues helps avoid
duplicates. When you open one, the more detail the better:

- **What you saw** — the page URL and a short description of the problem.
- **What you expected** — what the correct content or behavior should be.
- **How to reproduce** — for visual or interactive bugs, the steps you took, your
  browser, and a screenshot if you have one.
- **Suggested fix** — optional, but welcome.

Good first issues include: fixing typos or broken links, updating stale
information, improving accessibility, and proposing new content or sections.

## 2. Email us

Prefer email, or have something that does not fit a public issue? Write to:

- **<blanket@activeinference.institute>**

This reaches the Institute team directly. Use it for anything you would rather not
post publicly, partnership and content questions, or general feedback.

## Contributing changes directly

If you would like to submit a change yourself:

1. **Fork** this repository and create a branch for your change.
2. **Make your edits.** Page and site content lives under `src/content/`; the
   static site is assembled by `src/build.mjs` into the served HTML.
3. **Build and verify** before opening a pull request:

   ```bash
   npm install
   npm run build
   npm run check
   ```

   `npm run check` runs the link, contract, and security gates that every page
   must pass. Please make sure it succeeds locally.
4. **Open a pull request** against the default branch and describe what changed
   and why. Link any related issue.

A few conventions worth knowing:

- The site ships a strict Content-Security-Policy. Generated pages use **external,
  same-origin** scripts and styles only — no inline `<script>`, no inline event
  handlers, and no third-party resources.
- External links must be backed by the verified source registry
  (`src/content/live-sources.json`) and open in a new tab with
  `rel="noopener noreferrer"`.
- Keep content public and accurate; this repository is for public Institute
  information only.

## Code of conduct

Please be respectful and constructive in issues, pull requests, and email. We aim
to keep this a welcoming space for contributors of every background and
experience level.

---

*Act. Infer. Serve.*
