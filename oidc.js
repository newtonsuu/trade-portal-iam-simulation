// OIDC federation to Keycloak (loaded only when IDP=keycloak).
// Keycloak stands in for Microsoft Entra ID in the lab: it enforces MFA,
// passwordless/WebAuthn, brute-force protection, RBAC, and audit events.
const cfg = require('./config');

let client = null;

async function initOidc() {
  const { Issuer } = require('openid-client'); // lazy require
  const issuer = await Issuer.discover(cfg.oidc.issuer);
  client = new issuer.Client({
    client_id: cfg.oidc.clientId,
    client_secret: cfg.oidc.clientSecret,
    redirect_uris: [cfg.oidc.redirectUri],
    response_types: ['code']
  });
  return client;
}

function getClient() {
  return client;
}

// Map Keycloak realm roles (in the access token) to a single app role.
function decodeRoles(accessToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8')
    );
    const roles = (payload.realm_access && payload.realm_access.roles) || [];
    for (const r of ['admin', 'auditor', 'broker', 'user']) {
      if (roles.includes(r)) return r;
    }
  } catch (e) {
    /* fall through */
  }
  return 'user';
}

module.exports = { initOidc, getClient, decodeRoles };
