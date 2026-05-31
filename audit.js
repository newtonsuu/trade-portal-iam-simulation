// Audit logging. In the LEGACY build only login_success is recorded (modelling a
// portal with almost no security telemetry). In the MODERN build every security
// event is written as a JSON line — this is the evidence for the audit-logging finding.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const file = path.join(__dirname, 'logs', 'audit.log');
const LEGACY_ALLOWED = ['login_success'];

function audit(event, data = {}) {
  if (!cfg.isModern && !LEGACY_ALLOWED.includes(event)) return; // legacy logging gap
  const line = JSON.stringify({ ts: new Date().toISOString(), mode: cfg.MODE, event, ...data }) + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line);
}

module.exports = { audit, file };
