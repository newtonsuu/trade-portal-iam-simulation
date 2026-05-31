# Lab Runbook — Step-by-Step Simulation Procedures

> **Ethical scope:** Every command below targets only `http://localhost:3000` (your own lab).
> Nothing here touches any real or production system.

## 0. Prerequisites & install
1. Install **Node.js 22.5+ (or 24)** — the lab uses the built-in `node:sqlite`, so there is
   **no native compilation and no Visual Studio requirement**.
2. In PowerShell:
   ```powershell
   cd C:\Users\jericho.james.guanga\projects\trade-portal-simulation
   npm install
   ```

## 1. Running the two builds
- **Legacy (weak / "before"):**
  ```powershell
  npm run legacy
  ```
- **Modern (hardened / "after"):**
  ```powershell
  npm run modern
  ```
Both serve `http://localhost:3000`. The colored banner shows the active MODE. Run one at a time
(or set `PORT=3001` for the second). The database resets to seed data on every start.

Dummy accounts are listed on the login page.

---

## Scenario 1 — Weak Authentication
1. **Weak password acceptance:** Legacy → `/register`, create user with password `123456` → accepted.
   Modern → same → rejected by policy. Screenshot both. (`auth_attempts_template.csv`)
2. **No lockout (legacy):** log in as `normal_user` with wrong passwords ~20 times → never locked.
3. **Lockout (modern):** same → locked after 5 attempts (message changes).
4. **MFA (modern):** log in with correct password → redirected to `/mfa`. The OTP prints to the
   **server console**. Without it, access is denied. Screenshot the console + MFA prompt.

## Scenario 2 — Phishing Awareness
1. Obtain consent (`docs/consent_form.md`).
2. Serve the mock-up from a look-alike host:
   ```powershell
   # add to C:\Windows\System32\drivers\etc\hosts (admin):  127.0.0.1  tradeportaI-secure.local
   npx http-server .\phishing -p 8081
   ```
   Visit `http://tradeportaI-secure.local:8081` (note the capital "I").
3. Administer `docs/phishing_questionnaire.md`. Record scores only in
   `evidence/phishing_scores_template.csv`. The page captures nothing.

## Scenario 3 — Input Validation
1. **Verbose error (legacy):** in the Search box type a single quote `'` → raw SQL error page.
   Modern → handled safely, no error.
2. **Auth bypass (legacy):** on `/login`, username `' OR '1'='1' -- ` (any password) → logged in.
   Modern → invalid credentials.
3. **Reflected output (legacy):** Search for `<b>lab-test</b>` → renders as bold (unencoded).
   Modern → shown as literal text. Screenshot both.

## Scenario 4 — Broken Access Control
1. Log in as `normal_user`. Note the Admin link is hidden.
2. **Forced browsing:** manually visit `http://localhost:3000/admin`.
   Legacy → panel loads (bug). Modern → 403.
3. **IDOR:** as `client_beta`, open `http://localhost:3000/documents/1` (Broker Alpha's doc).
   Legacy → loads. Modern → 403. Fill `evidence/role_access_matrix_template.csv`.

## Scenario 5 — Session Management
1. Log in. Open **DevTools → Application → Cookies**. Record `sid` flags.
   Legacy → no HttpOnly/Secure/SameSite. Modern → HttpOnly + SameSite present.
2. **Logout replay:** copy the `sid` cookie value, log out, then re-send the old cookie
   (DevTools → re-add cookie, or `curl --cookie "sid=<value>" http://localhost:3000/dashboard`).
   Legacy → still authenticated. Modern → rejected.
3. **Idle timeout (modern):** stay idle > `IDLE_MS` (default 60s), then act → session expired.
   Fill `evidence/cookie_flags_template.csv`.

## Scenario 6 / 7 — IAM Modernization & Audit Logging
1. Run in modern mode; perform a login (with MFA), a denied access, and a logout.
2. Open `logs/audit.log` → modern records `login_success`, `login_failure`, `access_denied`,
   `admin_access`, `logout`. Re-run in legacy mode and repeat → only `login_success` appears.
3. (Optional, full IAM) Place the modern build behind **Keycloak** and map MFA, RBAC,
   Conditional-Access-style flows, and event logging as described in the methodology §8.

---

## OWASP ZAP passive evidence (optional, lab target only)
1. Set ZAP as your browser proxy. Browse the lab in **passive** mode only
   (Spider is acceptable on your own lab; do **not** run Active Scan against anything you do not own).
2. Export the **Alerts** report. Expect (legacy): missing security headers, cookie-flag alerts,
   information disclosure. Save as an evidence appendix.

## Capturing results
Record every test in `evidence/results_master_template.csv` and attach screenshots named
`S<scenario>-<testid>-<build>.png` (e.g., `S4-02-legacy.png`).
