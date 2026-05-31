# Security Risk Assessment and IAM Modernization of Legacy Web-Based Trade Portals
## Controlled Simulation Plan — Methodology & Controlled Simulation Results

> **Scope note.** This study does **not** scan, probe, attack, or send any traffic to a real or
> production system. A legacy web-based trade portal is used only as a general visual/functional
> *reference* to design a local mock-up. All testing occurs against a self-built prototype with
> dummy accounts and synthetic data. No real system is named, tested, or implicated. The runnable
> lab that accompanies this document is in the root of this repository.

---

## 1. Research Framing and Design Rationale

This study adopts a **prototype-based, controlled-simulation methodology** rather than live
penetration testing, for three reasons:

1. **Ethical and legal safety.** Testing a third-party production portal without written
   authorization may violate the Philippine Cybercrime Prevention Act of 2012 (RA 10175) and the
   Data Privacy Act of 2012 (RA 10173). A lab replica removes this risk entirely.
2. **Reproducibility.** A controlled mock-up lets other researchers and the thesis panel re-run
   every scenario deterministically — a core requirement of ACM-style empirical work.
3. **Pedagogical clarity.** Undergraduate researchers observe cause-and-effect (weak control →
   observable risk → mitigation → reduced risk) without the noise and danger of a real environment.

The mock-up — the **System Under Test (SUT)** — is a faithful functional imitation of a legacy
trade portal: a password-only login, a broker/client dashboard, a document-access module, an admin
panel, and server-managed sessions. It imitates behavior and structure, not any real site's code.

**Theoretical anchors:**
- OWASP Top 10 (2021) — A01 Broken Access Control, A03 Injection, A07 Identification & Authentication Failures, A05 Security Misconfiguration, A09 Logging & Monitoring Failures.
- OWASP Application Security Verification Standard (ASVS) 4.0 — control checklist.
- NIST SP 800-63B — Digital Identity Guidelines (authentication assurance).
- NIST SP 800-30 Rev.1 — Guide for Conducting Risk Assessments (likelihood × impact model).
- Microsoft Entra ID Zero Trust reference architecture — modernization comparison.

---

## 2. Lab Architecture (Global Setup)

All scenarios share one isolated environment, built once.

```
ISOLATED LAB (host-only / NAT network, no inbound internet)
  Tester VM (browser + OWASP ZAP) --> SUT mock portal (legacy + modern builds)
                                       Mock IdP: Keycloak (emulates Entra ID)
                                       Evidence/Logging host (SIEM or flat-file)
```

**Recommended stack (free / academic):**

| Layer | Tool | Purpose |
|---|---|---|
| Virtualization | VirtualBox / VMware Player | Isolated host-only network |
| Mock portal | Node.js + Express + EJS + `node:sqlite` | The SUT (this repository) |
| Mock Identity Provider | Keycloak (Docker) | Emulates Entra ID: MFA, RBAC, Conditional-Access-style flows, audit logs |
| Passive testing | OWASP ZAP (passive scan + spider only) | Header, cookie, config evidence |
| Manual HTTP inspection | Browser DevTools, Burp Community (manual proxy) | Session/cookie evidence |
| Logging/SIEM | Wazuh / ELK / structured log file | Audit-log evidence |
| Awareness test | Static HTML look-alike (no backend capture) | Phishing scenario |
| Documentation | Screenshots + result CSVs | Evidence |

**Two builds, one codebase.** The accompanying lab toggles between a deliberately-weak `legacy`
build and a hardened `modern` build via the `MODE` environment variable. The before/after
comparison is simply running the same procedures against each build. **All data is fictitious.**

---

## 3. Scenario 1 — Weak Authentication

**Objective.** Demonstrate that a password-only model accepts weak passwords and permits unbounded
login attempts, and quantify how MFA / passwordless reduces the risk.

**Lab setup.** Legacy: no password-complexity policy, no rate limiting, no lockout, no MFA.
Modern: password policy + TOTP MFA + lockout after N failures.

**Tools.** Browser, OWASP ZAP (passive), a small *self-authored* dummy-password list used only
against your own dummy accounts.

**Procedure.**
1. Legacy: register a dummy account with `123456`; record acceptance.
2. Log in with the weak password; record success.
3. Submit ~20 wrong passwords for your own dummy account; record whether lockout triggers.
4. Modern: repeat 1–3; observe policy rejection, MFA prompt, and lockout.
5. Modern: log in with correct password but no second factor; record denial.

**Expected observation.** Legacy: weak password accepted; unlimited attempts; single-factor
success. Modern: rejection; lockout; access denied without second factor.

**Evidence.** Screenshots (accepted weak password vs. policy rejection); attempt→outcome table;
lockout event log; ZAP note on missing security headers.

**Risk rating (L×I).** Legacy: 5×4 = **20 (Critical)**. Modern: 2×4 = **8 (Medium)**.

**Mitigation.** NIST SP 800-63B password guidance (length over complexity, breached-password
screening), lockout / exponential backoff, **MFA or passwordless (FIDO2/passkeys)**.

**Write-up.** Report as OWASP A07; emphasize the second factor (not complexity alone) as the
dominant mitigating control.

---

## 4. Scenario 2 — Phishing Login Awareness

**Objective.** Measure participants' ability to recognize a fraudulent login page. **No credential
capture of any kind.**

**Lab setup.** A static HTML page imitating the mock portal login, served from an obviously
different look-alike host on plain HTTP. The submit handler **discards all input** and shows a
debrief. No backend, no database, no logging of typed values.

**Tools.** Plain HTML/CSS/JS, a local web server, a consented questionnaire.

**Procedure.**
1. Obtain informed consent (awareness study, no data collected).
2. Present the legitimate mock portal and the look-alike side by side.
3. Ask participants to list suspicious indicators: URL spelling, missing HTTPS/padlock, unfamiliar
   domain, visual imitation, urgency wording, missing legal footer.
4. Record only the *score* (signs identified), never typed text.
5. Debrief and explain each indicator.

**Expected observation.** A distribution of detection scores; common misses (look-alike characters,
HTTP vs HTTPS).

**Evidence.** Annotated screenshot of planted cues; aggregate score table; consent form.

**Risk rating.** Pre-training human factor: 4×4 = **16 (High)**.

**Mitigation.** Recurring awareness training; **phishing-resistant authentication** (FIDO2 binds
credentials to origin, neutralizing credential phishing); domain monitoring.

**Write-up.** Report as a human-factor finding with descriptive statistics; stress that
passwordless authentication removes the value of stolen credentials even when humans are deceived.

---

## 5. Scenario 3 — Input Validation

**Objective.** Demonstrate that unvalidated input produces abnormal behavior, and that server-side
validation + parameterized queries remove it.

**Lab setup.** Legacy: a field that concatenates input into SQL and reflects it into HTML
unescaped. Modern: parameterized queries + output encoding.

**Tools.** Browser, DevTools, ZAP passive. Benign demonstration strings against your own lab DB
only (e.g., a single quote `'`; `<b>test</b>`). No exfiltration payloads, no external targets.

**Procedure.**
1. Legacy: enter `'`; observe whether a raw SQL error is returned.
2. Enter `<b>lab-test</b>`; observe whether it renders as markup.
3. Record error verbosity (stack traces, engine disclosure).
4. Modern: repeat; observe graceful handling, generic error, encoded output.

**Expected observation.** Legacy: verbose error / reflected markup. Modern: input treated as
literal data; generic error; no disclosure.

**Evidence.** Screenshots (verbose vs. generic error); ZAP information-disclosure alerts; code
snippet (concatenated query vs. prepared statement).

**Risk rating.** Legacy: 3×5 = **15 (High)**. Modern: 1×5 = **5 (Low)**.

**Mitigation.** Server-side validation (allow-listing), **parameterized queries**, output encoding,
generic non-disclosing errors (details logged server-side only).

**Write-up.** Report as OWASP A03; the legacy SUT returned a DB error on a single quote, indicating
absent sanitization; prepared statements reduced residual risk to Low.

---

## 6. Scenario 4 — Broken Access Control

**Objective.** Determine whether a low-privilege user can reach higher-role pages/documents, and
demonstrate server-side authorization as the fix.

**Lab setup.** Roles: normal user, broker/client, admin, auditor. Legacy: authorization only by
hiding UI links (client-side); direct URL access unprotected (forced browsing / IDOR). Modern:
server-side RBAC + object-level ownership checks on every request.

**Tools.** Browser, two role profiles, DevTools, optionally Burp Community (manual replay of your
own lab sessions).

**Procedure.**
1. Log in as normal user; note hidden admin links.
2. Manually navigate to `/admin` and to another user's document by ID.
3. Record whether the page/document loads.
4. Test horizontal access (one broker requesting another broker's document).
5. Modern: repeat; observe `403 Forbidden`.

**Role × Resource access matrix (example):**

| Resource | Normal | Broker | Admin | Auditor |
|---|---|---|---|---|
| Own documents | ✅ | ✅ | ✅ | ✅ (read-only) |
| Other broker docs (legacy) | ⚠️ Yes (bug) | ⚠️ Yes (bug) | ✅ | ✅ (read-only) |
| Other broker docs (modern) | ❌ 403 | ❌ 403 | ✅ | ✅ (read-only) |
| Admin panel (legacy) | ⚠️ Yes (bug) | ⚠️ Yes (bug) | ✅ | ❌ |
| Admin panel (modern) | ❌ 403 | ❌ 403 | ✅ | ❌ |

**Expected observation.** Legacy: direct URL grants access despite hidden UI. Modern: 403
regardless of UI state.

**Evidence.** Screenshot of normal user viewing the admin panel (legacy); 200 vs 403 request pair;
completed access matrix.

**Risk rating.** Legacy: 4×5 = **20 (Critical)**. Modern: 1×5 = **5 (Low)**.

**Mitigation.** **Server-side RBAC on every request**, least privilege, deny-by-default,
object-level authorization, indirect object references.

**Write-up.** OWASP A01; stress that hiding UI elements is not access control.

---

## 7. Scenario 5 — Session Management

**Objective.** Verify session lifecycle integrity: logout invalidation, idle timeout, cookie
hardening.

**Lab setup.** Legacy: cookie without `Secure`/`HttpOnly`/`SameSite`, no idle timeout, server-side
session not destroyed on logout. Modern: hardened flags, idle + absolute timeout, server-side
invalidation.

**Tools.** DevTools (cookies/network), ZAP passive (cookie-flag alerts), a copy of your own session
token.

**Procedure.**
1. Log in (legacy); inspect cookie flags.
2. Copy the session cookie; log out; replay the captured cookie on a protected page; record whether
   access continues.
3. Leave a session idle past the timeout; attempt an action.
4. Modern: repeat; observe hardened flags, rejected replay, enforced timeout.

**Expected observation.** Legacy: missing flags; access persists after logout; no timeout. Modern:
all flags present; replay rejected; timeout enforced.

**Evidence.** DevTools cookie-flag screenshots; post-logout replay result (200 legacy vs 401/redirect
modern); ZAP cookie alerts.

**Risk rating.** Legacy: 3×5 = **15 (High)**. Modern: 1×5 = **5 (Low)**.

**Mitigation.** `Secure`, `HttpOnly`, `SameSite` flags; idle + absolute timeouts; **server-side
session/token invalidation on logout**; session-ID rotation on privilege change.

**Write-up.** A05/A07; true logout is server-side invalidation, not cookie deletion.

---

## 8. Scenario 6 — IAM Modernization (Entra ID Concepts via Keycloak)

**Objective.** Show holistically how a modern IAM layer reduces aggregate risk versus a legacy-only
model, mapping each control to a Microsoft Entra ID concept.

**Lab setup.** Place the modern build behind Keycloak (IdP). Configure analogues:

| Entra ID concept | Keycloak lab analogue |
|---|---|
| Multi-Factor Authentication | TOTP/OTP required action |
| Conditional Access | Authentication flow conditions |
| Identity Protection (risk-based) | Brute-force detection + risky-login lockout |
| RBAC | Realm/client roles mapped to app authorization |
| Least privilege | Minimal default role, explicit grants |
| Audit logs | Keycloak Events → SIEM |
| Passwordless | WebAuthn/FIDO2 passkey login |

**Procedure.**
1. Demonstrate federated SSO login through Keycloak.
2. Enable a Conditional-Access-style rule (require MFA on an untrusted condition); show the prompt.
3. Enable WebAuthn; register a passkey; log in passwordlessly.
4. Trigger Identity-Protection-style lockout; show the event in Keycloak Events.
5. Export the audit event log.

**Expected observation.** A single hardened identity layer closes the weak-auth, session, and
access-control gaps simultaneously and produces centralized audit telemetry — none of which the
legacy-only model provides.

**Risk rating (aggregate).** Legacy-only: **Critical**. IAM-augmented: **Low–Medium**.

**Mitigation.** Adopt a **Zero Trust identity model**: centralized IdP, MFA/passwordless by
default, Conditional Access, RBAC + least privilege, continuous audit logging.

**Write-up.** This is the study's thesis — IAM modernization as a *systemic* control mitigating
multiple OWASP categories at once.

---

## 9. Audit Logging (Cross-Cutting)

Legacy: minimal/no security event logging. Modern: structured logs for login success/failure,
logout, access-denied, and admin actions, forwarded to a SIEM.

**Evidence.** Side-by-side of "events recorded" (legacy: 0–1 event types; modern: full lifecycle),
plus a SIEM dashboard screenshot.

**Risk rating.** Legacy: 4×3 = **12 (High)**. Modern: 2×3 = **6 (Medium)**.

---

## 10. Simulation Matrix

| # | Scenario | OWASP/NIST | Build | Primary tool | Key evidence | Mitigation shown |
|---|---|---|---|---|---|---|
| 1 | Weak Authentication | A07; 800-63B | legacy+modern | Browser, Keycloak, ZAP | attempt→outcome, lockout log | MFA, lockout, passwordless |
| 2 | Phishing Awareness | A07 (human) | static look-alike | HTML/JS, questionnaire | annotated cues, score table | awareness + FIDO2 |
| 3 | Input Validation | A03 | legacy+modern | Browser, ZAP | error screenshots, ZAP alerts | parameterized queries |
| 4 | Broken Access Control | A01 | legacy+modern | Browser, Burp | role×resource matrix, 200 vs 403 | server-side RBAC |
| 5 | Session Management | A05/A07 | legacy+modern | DevTools, ZAP | cookie flags, replay result | flags, timeout, invalidation |
| 6 | IAM Modernization | Zero Trust | modern+Keycloak | Keycloak, WebAuthn | config, events export | MFA, CA, IdP, passwordless |
| 7 | Audit Logging | A09 | legacy+modern | SIEM | event-coverage comparison | centralized logging |

---

## 11. Risk Matrix (Likelihood × Impact)

Scale 1–5 each. Bands: 1–4 Low · 5–9 Medium · 10–15 High · 16–25 Critical.

| Finding | Legacy L×I | Band | Modern L×I | Band |
|---|---|---|---|---|
| Weak authentication | 5×4 = 20 | Critical | 2×4 = 8 | Medium |
| Phishing susceptibility | 4×4 = 16 | High | 2×4 = 8 | Medium |
| Input validation | 3×5 = 15 | High | 1×5 = 5 | Low |
| Broken access control | 4×5 = 20 | Critical | 1×5 = 5 | Low |
| Session management | 3×5 = 15 | High | 1×5 = 5 | Low |
| Audit logging gap | 4×3 = 12 | High | 2×3 = 6 | Medium |

---

## 12. Before-and-After: Legacy-Only vs. IAM-Augmented Authentication

| Dimension | Legacy-only | IAM-augmented (Entra ID concepts) | Effect |
|---|---|---|---|
| Authentication factors | Password only | MFA / passwordless (FIDO2) | Critical → Medium |
| Password policy | None / weak | Enforced + breached-password screening | ↓ |
| Brute-force protection | None | Lockout + risk-based detection | ↓ |
| Authorization | Client-side hiding | Server-side RBAC, least privilege | Critical → Low |
| Session handling | No flags/timeout/invalidation | Hardened flags, timeouts, invalidation | High → Low |
| Access policy | Static | Conditional Access (context-aware) | ↓ |
| Identity management | Per-app local accounts | Centralized IdP + SSO | ↓ |
| Auditability | Minimal/no logs | Centralized audit events → SIEM | High → Medium |
| Phishing resilience | Reusable stolen credentials | Origin-bound passkeys | ↓ |
| **Aggregate posture** | **Critical** | **Low–Medium** | **Material reduction** |

---

## 13. Safe Rules-of-Engagement Statement

> This research is conducted exclusively within a self-contained, isolated laboratory environment
> owned and operated by the researchers. All testing targets a purpose-built mock-up (the System
> Under Test) populated solely with fictitious accounts and synthetic data. No testing, scanning,
> probing, login attempt, traffic generation, or data collection is or will be directed at any
> real, production, or third-party system. No brute-force, denial-of-service, destructive,
> exploitation, data-extraction, or evasion techniques are performed against any live system.
> OWASP ZAP and similar tools are used in passive mode against the local mock-up only. Should any
> future testing of a real system be contemplated, it will proceed only upon a signed authorization
> and a documented, scoped Rules-of-Engagement agreement with the system owner, in compliance with
> RA 10175 and RA 10173. Participants in the phishing-awareness component provide informed consent,
> and no credentials or personal data are captured or stored at any point.

---

## 14. Non-Attribution / No-Claim Disclaimer

> The vulnerabilities demonstrated in this study are properties of a deliberately weakened
> laboratory mock-up, configured by the researchers to exhibit known insecure patterns for
> educational and analytical purposes. These results do not assert, imply, or constitute a claim
> that any specific real website or its operator possesses any of these weaknesses. The actual
> security posture of any production system is unknown to the researchers and was not tested. The
> mock-up serves as an analogue for studying classes of risk common to legacy trade portals
> generally, not as evidence about any specific live deployment.

---

## 15. Significance of the Study

Legacy web-based trade portals frequently persist on password-only authentication,
perimeter-implicit trust, and minimal audit instrumentation — increasingly misaligned with the
threat landscape and with modern identity standards such as NIST SP 800-63B and Zero Trust
architectures. This study contributes a **reproducible, ethics-bound simulation framework** that
allows the security risks of such portals to be observed, measured, and mitigated without
endangering any production system or violating Philippine law. By instantiating a controlled
mock-up and subjecting it to structured scenarios spanning authentication, phishing awareness,
input validation, access control, session management, and audit logging, the research produces
empirical likelihood-by-impact risk ratings for each weakness class. By re-running identical
procedures against an **IAM-modernized build** employing Microsoft Entra ID concepts, the study
quantifies the risk reduction attributable to identity modernization specifically — moving the
aggregate posture from *Critical* to *Low–Medium*. The framework benefits **practitioners** (a
defensible business case for IAM investment), **educators and students** (a safe hands-on lab), and
**the academic community** (a replicable methodology that decouples meaningful security research
from the legal and ethical hazards of testing live third-party systems). In sum, the study advances
the position that **modern IAM is a systemic control** capable of mitigating multiple OWASP risk
categories simultaneously — demonstrated entirely within ethical academic boundaries.

---

## 16. Assembling Into the Paper

- **Methodology:** §1–§2, §13, and each scenario's *Lab setup / Tools / Procedure*.
- **Controlled Simulation Results:** each scenario's *Expected observation / Evidence / Risk rating*, plus §10–§12 tables.
- **Discussion / Significance:** §8 synthesis, §14 disclaimer, §15 significance.
- **Appendices:** consent form, seed-data list, ZAP passive export, Keycloak events export, screenshot log (see `docs/SCREENSHOT_CHECKLIST.md`).
