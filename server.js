/*
 * Trade Portal — Controlled Simulation Mock-up
 * ============================================
 * ONE codebase, TWO behaviours via the MODE env var:
 *   MODE=legacy  -> deliberately weak controls (the "before" build)
 *   MODE=modern  -> hardened + IAM-style controls (the "after" build)
 *
 * SAFETY: This app is for an isolated lab only. It contains intentionally
 * vulnerable code paths (in legacy mode) for academic demonstration against
 * dummy data. NEVER expose it to the internet or point any test at a real site.
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const cfg = require('./config');
const { db, seed, hashPassword, verifyPassword } = require('./db');
const { audit } = require('./audit');

seed(); // deterministic reset on every start

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Session configuration differs by mode (Scenario 5: session management) ----
app.use(session({
  name: 'sid',
  secret: 'lab-only-not-a-real-secret',
  resave: false,
  saveUninitialized: false,
  rolling: cfg.isModern, // modern: reset idle timer on each request
  cookie: {
    httpOnly: cfg.isModern,                  // legacy: false -> readable by JS
    secure: false,                           // lab uses HTTP; set true behind TLS in prod
    sameSite: cfg.isModern ? 'lax' : false,  // legacy: no SameSite
    maxAge: cfg.isModern ? cfg.idleTimeoutMs : null // legacy: no expiry policy
  }
}));

// In-memory failed-login tracker (Scenario 1: lockout, modern only)
const failed = Object.create(null); // username -> { count, lockedUntil }

app.use((req, res, next) => {
  res.locals.mode = cfg.MODE;
  res.locals.user = req.session.user || null;
  res.locals.title = 'Trade Portal (Lab)';
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

// =====================================================================
// LOGIN  (Scenario 1: weak auth, Scenario 3: injection/verbose errors)
// =====================================================================
app.get('/login', (req, res) => {
  if (cfg.idp === 'keycloak') {
    const { getClient } = require('./oidc');
    const { generators } = require('openid-client');
    const oidcClient = getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    req.session.oidc = { state, nonce };
    return res.redirect(oidcClient.authorizationUrl({ scope: 'openid profile', state, nonce }));
  }
  res.render('login', { msg: req.query.msg || '' });
});

// OIDC callback (Keycloak). Exchanges the auth code, maps realm roles to the session.
app.get('/auth/callback', async (req, res) => {
  if (cfg.idp !== 'keycloak') return res.redirect('/login');
  const { getClient, decodeRoles } = require('./oidc');
  const oidcClient = getClient();
  try {
    const params = oidcClient.callbackParams(req);
    const expected = req.session.oidc || {};
    const tokenSet = await oidcClient.callback(cfg.oidc.redirectUri, params, {
      state: expected.state,
      nonce: expected.nonce
    });
    const claims = tokenSet.claims();
    req.session.user = {
      username: claims.preferred_username || 'unknown',
      role: decodeRoles(tokenSet.access_token)
    };
    req.session.id_token = tokenSet.id_token;
    audit('login_success', { user: req.session.user.username, role: req.session.user.role, idp: 'keycloak' });
    res.redirect('/dashboard');
  } catch (e) {
    audit('login_failure', { idp: 'keycloak', error: e.message });
    res.status(401).render('error', { generic: true, detail: '' });
  }
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;

  if (cfg.isModern) {
    // ---- MODERN: parameterized query + scrypt verify + lockout ----
    const rec = failed[username];
    if (rec && rec.lockedUntil > Date.now()) {
      audit('login_locked', { user: username });
      return res.render('login', { msg: 'Account temporarily locked. Try again later.' });
    }
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const ok = row && verifyPassword(password, row.salt, row.password_hash);
    if (!ok) {
      const r = failed[username] || { count: 0, lockedUntil: 0 };
      r.count += 1;
      if (r.count >= cfg.lockoutThreshold) {
        r.lockedUntil = Date.now() + cfg.lockoutMs;
        r.count = 0;
      }
      failed[username] = r;
      audit('login_failure', { user: username });
      return res.render('login', { msg: 'Invalid credentials.' });
    }
    failed[username] = { count: 0, lockedUntil: 0 };
    // Step-up to MFA before establishing the authenticated session
    const otp = ('' + crypto.randomInt(0, 1000000)).padStart(6, '0');
    req.session.pending = { username: row.username, role: row.role };
    req.session.otp = otp;
    console.log(`\n[MFA] One-time code for ${row.username}: ${otp}\n`);
    return res.redirect('/mfa');
  }

  // ---- LEGACY: vulnerable string-concatenated SQL, no lockout, no MFA ----
  const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  let row;
  try {
    row = db.prepare(sql).get();
  } catch (e) {
    // Verbose error disclosure (Scenario 3)
    return res.status(500).render('error', { generic: false, detail: e.message + '\n\nQuery: ' + sql });
  }
  if (!row) return res.render('login', { msg: 'Invalid credentials.' });
  req.session.user = { username: row.username, role: row.role };
  audit('login_success', { user: row.username, role: row.role });
  res.redirect('/dashboard');
});

// MFA step (modern only)
app.get('/mfa', (req, res) => {
  if (!req.session.pending) return res.redirect('/login');
  res.render('mfa', { msg: '' });
});
app.post('/mfa', (req, res) => {
  if (!req.session.pending) return res.redirect('/login');
  if ((req.body.otp || '') !== req.session.otp) {
    audit('mfa_failure', { user: req.session.pending.username });
    return res.render('mfa', { msg: 'Incorrect code.' });
  }
  req.session.user = req.session.pending;
  delete req.session.pending;
  delete req.session.otp;
  audit('login_success', { user: req.session.user.username, role: req.session.user.role, mfa: true });
  res.redirect('/dashboard');
});

// =====================================================================
// REGISTER  (Scenario 1: weak password acceptance)
// =====================================================================
app.get('/register', (req, res) => res.render('register', { msg: '' }));
app.post('/register', (req, res) => {
  const { username = '', password = '' } = req.body;
  if (cfg.isModern) {
    const p = cfg.passwordPolicy;
    if (password.length < p.minLength)
      return res.render('register', { msg: `Password must be at least ${p.minLength} characters.` });
    if (p.common.includes(password.toLowerCase()))
      return res.render('register', { msg: 'Password is too common / breached.' });
  }
  try {
    const salt = crypto.randomBytes(8).toString('hex');
    db.prepare('INSERT INTO users(username,password,salt,password_hash,role) VALUES(?,?,?,?,?)')
      .run(username, password, salt, hashPassword(password, salt), 'user');
  } catch (e) {
    return res.render('register', { msg: 'Could not create account (maybe it exists).' });
  }
  res.redirect('/login?msg=Account created. Please sign in.');
});

// =====================================================================
// DASHBOARD
// =====================================================================
app.get('/dashboard', requireLogin, (req, res) => {
  const docs = db.prepare('SELECT id,title,owner,classification FROM documents').all();
  res.render('dashboard', { docs });
});

// =====================================================================
// DOCUMENT ACCESS  (Scenario 4: broken access control / IDOR)
// =====================================================================
app.get('/documents/:id', requireLogin, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).render('error', { generic: true, detail: '' });

  if (cfg.isModern) {
    const u = req.session.user;
    const allowed =
      doc.classification === 'public' ||
      u.role === 'admin' ||
      u.role === 'auditor' ||            // auditor: read-only access to all
      doc.owner === u.username;          // owner-only for normal/broker
    if (!allowed) {
      audit('access_denied', { user: u.username, resource: `document:${doc.id}` });
      return res.status(403).render('error', { generic: true, detail: '' });
    }
  }
  // LEGACY: no server-side authorization at all -> any logged-in user reads any doc
  res.render('document', { doc });
});

// =====================================================================
// ADMIN PANEL  (Scenario 4: forced browsing)
// =====================================================================
app.get('/admin', requireLogin, (req, res) => {
  if (cfg.isModern && req.session.user.role !== 'admin') {
    audit('access_denied', { user: req.session.user.username, resource: 'admin_panel' });
    return res.status(403).render('error', { generic: true, detail: '' });
  }
  // LEGACY: route is open to any logged-in user; only the UI link is hidden.
  const users = db.prepare('SELECT id,username,role FROM users').all();
  audit('admin_access', { user: req.session.user.username });
  res.render('admin', { users });
});

// =====================================================================
// SEARCH  (Scenario 3: injection + reflected output)
// =====================================================================
app.get('/search', requireLogin, (req, res) => {
  const q = req.query.q;
  if (q === undefined) return res.render('search', { q: '', results: [], rawEcho: !cfg.isModern });

  let results = [];
  if (cfg.isModern) {
    results = db.prepare('SELECT title,classification FROM documents WHERE title LIKE ?').all(`%${q}%`);
  } else {
    const sql = `SELECT title,classification FROM documents WHERE title LIKE '%${q}%'`;
    try {
      results = db.prepare(sql).all();
    } catch (e) {
      return res.status(500).render('error', { generic: false, detail: e.message + '\n\nQuery: ' + sql });
    }
  }
  res.render('search', { q, results, rawEcho: !cfg.isModern });
});

// =====================================================================
// LOGOUT  (Scenario 5: session invalidation)
// =====================================================================
app.get('/logout', (req, res) => {
  const u = req.session.user && req.session.user.username;
  if (cfg.idp === 'keycloak') {
    const { getClient } = require('./oidc');
    const idToken = req.session.id_token;
    const endUrl = getClient().endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: cfg.oidc.postLogout
    });
    return req.session.destroy(() => {
      res.clearCookie('sid');
      audit('logout', { user: u, idp: 'keycloak' });
      res.redirect(endUrl); // single sign-out at the IdP
    });
  }
  if (cfg.isModern) {
    req.session.destroy(() => {
      res.clearCookie('sid');
      audit('logout', { user: u });
      res.redirect('/login?msg=You have been logged out.');
    });
  } else {
    // LEGACY: only clears the cookie client-side; server session stays valid,
    // so a replayed cookie still authenticates.
    res.clearCookie('sid');
    res.redirect('/login?msg=You have been logged out.');
  }
});

async function start() {
  if (cfg.idp === 'keycloak') {
    const { initOidc } = require('./oidc');
    try {
      await initOidc();
      console.log(`OIDC federation enabled — issuer: ${cfg.oidc.issuer}`);
    } catch (e) {
      console.error(`\n[FATAL] Could not reach Keycloak at ${cfg.oidc.issuer}`);
      console.error('  Start Keycloak first (see keycloak/README.md), then retry.');
      console.error('  Error:', e.message, '\n');
      process.exit(1);
    }
  }
  app.listen(cfg.port, () => {
    console.log(`\nTrade Portal lab running in ${cfg.MODE.toUpperCase()} mode` +
      (cfg.idp === 'keycloak' ? ' + Keycloak IdP' : ''));
    console.log(`  http://localhost:${cfg.port}`);
    console.log('  LAB ONLY — dummy data — do not expose to the internet.\n');
  });
}

start();
