// Data layer. Uses a local SQLite file populated ONLY with fictitious dummy data.
// The plaintext `password` column exists solely to demonstrate the legacy SQL-string
// concatenation flaw; the modern build authenticates against scrypt `password_hash`.
// Uses Node's built-in SQLite (node:sqlite) — no native compilation required.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const cfg = require('./config');

// Per-mode database file so the legacy and modern builds can run side-by-side
// (for before/after screenshots) without locking each other.
const db = new DatabaseSync(path.join(__dirname, `lab-${cfg.MODE}.db`));
db.exec('PRAGMA busy_timeout = 3000;');

function hashPassword(pw, salt) {
  return crypto.scryptSync(pw, salt, 32).toString('hex');
}

function verifyPassword(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  const a = Buffer.from(h, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function seed() {
  db.exec('DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS documents;');
  db.exec(`CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,          -- plaintext: demonstrates legacy injection flaw only
      salt TEXT,
      password_hash TEXT,     -- scrypt: used by the modern build
      role TEXT
  );`);
  db.exec(`CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      title TEXT,
      body TEXT,
      owner TEXT,
      classification TEXT
  );`);

  // [username, password, role]  -- all fictitious
  const users = [
    ['normal_user', '123456', 'user'],
    ['broker_alpha', 'password', 'broker'],
    ['client_beta', 'qwerty', 'broker'],
    ['admin_root', 'Admin@SuperSecure#2026', 'admin'],
    ['auditor_one', 'Auditor@Strong#2026', 'auditor']
  ];
  const insUser = db.prepare(
    'INSERT INTO users(username,password,salt,password_hash,role) VALUES(?,?,?,?,?)'
  );
  for (const [u, p, r] of users) {
    const salt = crypto.randomBytes(8).toString('hex');
    insUser.run(u, p, salt, hashPassword(p, salt), r);
  }

  const docs = [
    ['Trade License A-1001', 'Import permit details for Broker Alpha.', 'broker_alpha', 'restricted'],
    ['Trade License B-2002', 'Customs clearance details for Client Beta.', 'client_beta', 'restricted'],
    ['Internal Admin Audit Notes', 'Confidential admin-only operational notes.', 'admin_root', 'confidential'],
    ['Public Tariff Schedule', 'Publicly available tariff information.', 'public', 'public']
  ];
  const insDoc = db.prepare(
    'INSERT INTO documents(title,body,owner,classification) VALUES(?,?,?,?)'
  );
  for (const d of docs) insDoc.run(...d);
}

module.exports = { db, seed, hashPassword, verifyPassword };
