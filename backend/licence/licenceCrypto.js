const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PUBLIC_KEY_PATH = path.join(__dirname, '../config/licence-public-key.pem');

let publicKey = null;
try {
  publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));
} catch {
  // No key committed yet (e.g. before `tools/licence-keygen.js` has run once) —
  // install() will report every uploaded licence as invalid, which is the
  // correct, safe default rather than throwing at boot.
}

/** Deterministic byte representation of a payload, sorted keys, no whitespace. */
function canonicalize(payload) {
  return Buffer.from(JSON.stringify(payload, Object.keys(payload).sort()), 'utf8');
}

function verify(document) {
  if (!document || typeof document !== 'object') {
    return { ok: false, reason: 'Fichier de licence illisible' };
  }
  const { version, payload, signature } = document;
  if (version !== 1 || !payload || typeof payload !== 'object' || typeof signature !== 'string') {
    return { ok: false, reason: 'Structure de licence invalide' };
  }
  if (!payload.licenceId || !payload.customer || !payload.issuedAt || !payload.expiresAt) {
    return { ok: false, reason: 'Structure de licence invalide' };
  }
  if (!publicKey) {
    return { ok: false, reason: 'Aucune clé publique de licence installée sur ce serveur' };
  }

  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(signature, 'base64');
  } catch {
    return { ok: false, reason: 'Signature de licence illisible' };
  }

  const valid = crypto.verify(null, canonicalize(payload), publicKey, signatureBuffer);
  if (!valid) {
    return { ok: false, reason: 'Signature de licence invalide ou fichier altéré' };
  }
  return { ok: true, payload };
}

function daysRemaining(expiresAt, now = Date.now()) {
  return Math.ceil((new Date(expiresAt).getTime() - now) / 86400000);
}

module.exports = { canonicalize, verify, daysRemaining };
