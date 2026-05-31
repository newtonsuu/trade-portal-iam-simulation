# Keycloak IdP — Demonstrating Microsoft Entra ID Concepts (Scenario 6)

Keycloak is used here as a **local stand-in for Microsoft Entra ID**. It lets the study
demonstrate modern IAM controls — MFA, passwordless, conditional/adaptive policy, RBAC,
least privilege, and centralized audit logging — without any cloud tenant or real data.

> **Requires Docker Desktop.** (This lab machine had no Docker, so this federation path is
> provided ready-to-run but was not smoke-tested here. The standalone `MODE=modern` build was
> fully tested and already demonstrates MFA, RBAC, session hardening, and audit logging without Keycloak.)

## Entra ID ↔ Keycloak mapping

| Microsoft Entra ID concept | Where it lives in this realm | Evidence to capture |
|---|---|---|
| Multi-Factor Authentication | `requiredActions: CONFIGURE_TOTP` on every user + OTP policy | TOTP enrollment + code prompt |
| Passwordless authentication | `webAuthnPolicyPasswordless*` (enable the passwordless flow in console) | Passkey/security-key login |
| Identity Protection (risk-based lockout) | `bruteForceProtected`, `failureFactor: 5` | Realm → Sessions / Events showing lockout |
| Conditional Access | Authentication → Flows (add conditions, e.g. require OTP) | Flow diagram + enforced prompt |
| RBAC | Realm roles `user / broker / admin / auditor` mapped to users | Role mappings screen |
| Least privilege | Each user holds exactly one role | Users → Role mapping |
| Centralized audit logging | `eventsEnabled` + `adminEventsEnabled` | Realm → Events (login, logout, failures) |
| Single sign-out | OIDC end-session (portal `/logout` redirects to Keycloak) | Logout terminates IdP session |
| Password policy | `passwordPolicy: length(12) ...` | Realm → Authentication → Policies |

## 1. Start Keycloak
```powershell
cd C:\Users\jericho.james.guanga\projects\trade-portal-simulation\keycloak
docker compose up        # first start imports the tradeportal realm (~30-60s)
```
- Admin console: `http://localhost:8080/`  (admin / admin)
- Realm issuer: `http://localhost:8080/realms/tradeportal`

## 2. Run the portal federated to Keycloak
In a second terminal:
```powershell
cd C:\Users\jericho.james.guanga\projects\trade-portal-simulation
npm install
cross-env MODE=modern IDP=keycloak node --no-warnings server.js
```
Visit `http://localhost:3000/login` → you are redirected to Keycloak. On first login each user
is forced to enrol TOTP (MFA). After login, realm roles are mapped to the portal's RBAC, so the
same broken-access-control tests (§Scenario 4) now return 403 — enforced by the IdP-issued identity.

## 3. Demonstrating each control (for screenshots)
1. **MFA:** log in as `broker_alpha` / `Broker@Strong#2026` → scan the TOTP QR → enter code.
2. **Passwordless:** Console → Authentication → Flows → duplicate *browser*, add *WebAuthn
   Passwordless*, bind it as the browser flow; register a passkey (or virtual authenticator in
   Chrome DevTools) and log in with no password.
3. **Risk-based lockout:** enter a wrong password 5×; observe the temporary lockout and the
   matching entry in Realm → Events.
4. **Conditional Access:** Console → Authentication → Flows → add a *Condition* (e.g. require OTP);
   capture the flow and the enforced prompt.
5. **Audit logging:** Realm → Events → Login/Admin events; export as evidence.

## Credentials (lab dummy data)
admin/admin (Keycloak console) · portal users: `*_alpha`, `client_beta`, `admin_root`,
`auditor_one`, `normal_user` with the `*@Strong#2026` passwords in `realm-export.json`.

## Reset
`docker compose down` then `docker compose up` re-imports a clean realm.
