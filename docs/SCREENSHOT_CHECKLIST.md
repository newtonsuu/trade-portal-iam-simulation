# Evidence / Screenshot Capture Checklist

Capture each item below and save with the exact filename so figures map cleanly into the paper's
Controlled Simulation Results section and appendix. Suggested format: PNG, full window, redact nothing
(all data is dummy). Naming: `S<scenario>-<id>-<build>.png`.

> Tip: keep two browser windows side-by-side (legacy red banner vs. modern green banner) so each
> before/after pair is one glance for the reader.

## Scenario 1 — Weak Authentication
- [ ] `S1-01-legacy.png` — registration accepting password `123456`
- [ ] `S1-03-modern.png` — registration rejecting weak password ("at least 12 characters")
- [ ] `S1-02-legacy.png` — many failed logins, no lockout (with attempt table)
- [ ] `S1-04-modern.png` — account locked after 5 attempts
- [ ] `S1-05-modern.png` — server console showing OTP **+** the `/mfa` prompt (MFA required)

## Scenario 2 — Phishing Awareness
- [ ] `S2-01-mockup.png` — the look-alike page with the 6 indicators annotated (URL, HTTP, urgency, spelling, styling, footer)
- [ ] `S2-02-debrief.png` — the "no data was captured" debrief after submit
- [ ] `S2-03-scores.png` — aggregate detection-score chart from `phishing_scores_template.csv`

## Scenario 3 — Input Validation
- [ ] `S3-01-legacy.png` — verbose SQL error page after submitting `'`
- [ ] `S3-04-modern.png` — same input handled safely (no error)
- [ ] `S3-02-legacy.png` — auth bypass via `' OR '1'='1' -- ` → logged in
- [ ] `S3-03-legacy.png` — reflected `<b>lab-test</b>` rendered as markup
- [ ] `S3-05-compare.png` — code diff: concatenated query vs. parameterized query

## Scenario 4 — Broken Access Control
- [ ] `S4-01-legacy.png` — `normal_user` viewing `/admin` (forced browsing succeeds)
- [ ] `S4-03-modern.png` — same request returning 403
- [ ] `S4-02-legacy.png` — `client_beta` opening Broker Alpha's document (IDOR)
- [ ] `S4-04-modern.png` — same request returning 403
- [ ] `S4-05-matrix.png` — completed role × resource matrix from CSV

## Scenario 5 — Session Management
- [ ] `S5-01-legacy.png` — DevTools cookie `sid` with NO HttpOnly/Secure/SameSite
- [ ] `S5-03-modern.png` — DevTools cookie `sid` WITH HttpOnly + SameSite + Expires
- [ ] `S5-02-legacy.png` — replayed cookie still authenticated after logout (200)
- [ ] `S5-04-modern.png` — replayed cookie rejected after logout
- [ ] `S5-05-modern.png` — session expired after idle timeout

## Scenario 6 — IAM Modernization (Keycloak / Entra ID concepts)
- [ ] `S6-01-mfa.png` — Keycloak TOTP enrollment QR + code prompt
- [ ] `S6-02-passwordless.png` — WebAuthn/passkey login (no password)
- [ ] `S6-03-conditional.png` — Authentication flow with a condition (Conditional Access analogue)
- [ ] `S6-04-rbac.png` — user role mappings (least privilege)
- [ ] `S6-05-lockout.png` — brute-force lockout event (Identity Protection analogue)
- [ ] `S6-06-federation.png` — portal redirecting to Keycloak and back (SSO)

## Scenario 7 — Audit Logging
- [ ] `S7-01-legacy.png` — `logs/audit.log` showing only `login_success`
- [ ] `S7-02-modern.png` — `logs/audit.log` showing full lifecycle (failure, MFA, access_denied, logout)
- [ ] `S7-03-keycloak.png` — Keycloak Realm → Events list (or exported events)

## Cross-cutting
- [ ] `ZAP-passive-legacy.png` — OWASP ZAP passive Alerts summary (missing headers, cookie flags, info disclosure) — lab target only
- [ ] `ZAP-passive-modern.png` — same scan against the modern build for comparison

## Tables to export (CSV → formatted table in paper)
- [ ] Simulation matrix (`results_master_template.csv`)
- [ ] Risk matrix (likelihood × impact, before/after)
- [ ] Role × resource access matrix
- [ ] Cookie-flags comparison
- [ ] Phishing detection scores (aggregate)
- [ ] Audit event-coverage comparison (legacy vs. modern)
