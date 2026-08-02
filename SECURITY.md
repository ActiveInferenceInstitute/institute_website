# Security Policy

The Active Inference Institute website is a static, dependency-free GitHub Pages
site. It ships no forms, no third-party scripts, and no client-side network
requests (strict CSP: `script-src 'self'`, `connect-src 'none'`), so its attack
surface is deliberately small. We still welcome responsible disclosure.

## Reporting a vulnerability

Please report security issues privately, never in a public issue:

- **Email:** blanket@activeinference.institute
  (also published per [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) in
  [`.well-known/security.txt`](.well-known/security.txt))
- **GitHub:** [Private vulnerability reporting](https://github.com/ActiveInferenceInstitute/institute_website/security/advisories)

Please include the affected URL, a minimal description of the issue, and — where
possible — steps to reproduce. We aim to acknowledge reports within a few
business days.

## Scope

In scope: the content of this repository (`src/`, `assets/`, generated pages)
and the deployed site at <https://activeinference.institute/>.

Out of scope: third-party services linked from the site (e.g. YouTube, GitHub,
external publications) and any private InstituteOS repositories.

## Our security posture

- Static output only — no server-side processing, no runtime framework.
- Every rendered page carries a strict Content-Security-Policy meta tag and a
  `strict-origin-when-cross-origin` referrer policy, enforced by
  `scripts/check_static_security.py` (`npm run check:security`).
- External anchors resolve through the verified registry in
  `src/content/live-sources.json`; unregistered external links fail the gate.
- No secrets or credentials are stored in this repository; generated files
  must never contain private operational data (see the public-safety gates in
  `npm run check`).
