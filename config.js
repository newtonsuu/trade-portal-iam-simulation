// Central configuration. The MODE environment variable flips the SAME codebase
// between the deliberately-weak "legacy" build and the hardened "modern" build.
// This single toggle is what powers the before/after comparison in the paper.
const MODE = (process.env.MODE || 'legacy').toLowerCase();

module.exports = {
  MODE,
  isModern: MODE === 'modern',
  port: parseInt(process.env.PORT || '3000', 10),

  // Session / cookie behaviour
  idleTimeoutMs: parseInt(process.env.IDLE_MS || '60000', 10), // modern idle timeout (default 60s for demo)

  // Brute-force / lockout (modern only)
  lockoutThreshold: 5,
  lockoutMs: 60 * 1000,

  // Password policy (enforced in modern only)
  passwordPolicy: {
    minLength: 12,
    common: ['123456', 'password', 'qwerty', 'admin', '12345678', '111111', 'letmein']
  },

  // Identity provider. 'local' = built-in login (default, fully tested).
  // 'keycloak' = federate to Keycloak via OIDC (demonstrates Entra ID concepts).
  idp: (process.env.IDP || 'local').toLowerCase(),
  oidc: {
    issuer: process.env.OIDC_ISSUER || 'http://localhost:8080/realms/tradeportal',
    clientId: process.env.OIDC_CLIENT_ID || 'trade-portal',
    clientSecret: process.env.OIDC_CLIENT_SECRET || 'trade-portal-secret-lab',
    redirectUri: process.env.OIDC_REDIRECT || 'http://localhost:3000/auth/callback',
    postLogout: process.env.OIDC_POST_LOGOUT || 'http://localhost:3000/login'
  }
};
