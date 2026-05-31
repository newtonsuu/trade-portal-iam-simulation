# Trade Portal — Controlled Simulation Lab

A runnable mock-up supporting the ACM-style case study **"Security Risk Assessment and
IAM Modernization of Legacy Web-Based Trade Portals."** It imitates a legacy trade portal's
login, dashboard, document access, admin panel, and session behavior so that security risks
can be observed and mitigated **safely, against dummy data, in an isolated lab.**

> ⚠️ **Ethical scope.** This project is for a private lab only. It contains intentionally
> vulnerable code paths (in legacy mode) for academic demonstration. It must **never** be
> exposed to the internet, and **no test in this repository targets any real/production
> website**. A legacy trade portal was used only as a general visual/functional reference for
> designing this imitation; no real system is named, tested, or implicated. See `docs/RUNBOOK.md`
> and the thesis Rules-of-Engagement statement.

## One codebase, two builds
The **same app** flips behavior with the `MODE` environment variable:

| | `MODE=legacy` (before) | `MODE=modern` (after) |
|---|---|---|
| Passwords | any weak password accepted | policy-enforced, scrypt-hashed |
| Brute force | no lockout | lockout after 5 attempts |
| Second factor | none | MFA (OTP) step-up |
| SQL | string-concatenated (injectable) | parameterized |
| Output | unencoded (reflected XSS) | encoded |
| Errors | verbose disclosure | generic |
| Authorization | client-side hiding only | server-side RBAC + ownership |
| Cookies | no HttpOnly/Secure/SameSite | hardened flags + idle timeout |
| Logout | cookie cleared only | server-side session destroy |
| Audit log | login_success only | full event lifecycle |

## Quick start
```powershell
npm install
npm run legacy     # weak build  -> http://localhost:3000
# or
npm run modern     # hardened build
```

## Optional: federate to Keycloak (Scenario 6 — Entra ID concepts)
```powershell
cd keycloak; docker compose up        # starts Keycloak + imports the realm
# then, in the project root:
cross-env MODE=modern IDP=keycloak node --no-warnings server.js
```
This redirects login to Keycloak, which demonstrates MFA, passwordless/WebAuthn,
risk-based lockout, RBAC, and centralized audit events. See `keycloak/README.md`.
Requires Docker Desktop; the standalone `MODE=modern` build needs no Docker.

## Contents
- `server.js`, `db.js`, `audit.js`, `config.js`, `oidc.js` — the mock portal (+ optional OIDC)
- `views/`, `public/` — UI
- `keycloak/` — docker-compose + realm import + Entra ID concept mapping
- `phishing/index.html` — harmless awareness mock-up (captures nothing)
- `evidence/*.csv` — fill-in result templates (master matrix, auth attempts, role matrix, cookie flags, phishing scores)
- `docs/THESIS_METHODOLOGY.md` — full thesis-ready Methodology + Results + significance
- `docs/RUNBOOK.md` — step-by-step procedure for all six scenarios
- `docs/SCREENSHOT_CHECKLIST.md` — every figure mapped to its filename
- `docs/consent_form.md`, `docs/phishing_questionnaire.md` — ethics + awareness instruments
- `LICENSE` — MIT (with an intentionally-vulnerable-code notice)

Map each scenario to OWASP/NIST references and risk ratings using the methodology document
that accompanies this study.
