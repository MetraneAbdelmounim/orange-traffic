const crypto = require('crypto');
const Licence = require('./licence');
const licenceCrypto = require('./licenceCrypto');

const DEMO_DAYS = 10;

function toStatus(doc) {
  if (!doc) {
    return { installed: false, valid: false, type: null, daysRemaining: 0 };
  }
  const daysRemaining = licenceCrypto.daysRemaining(doc.expiresAt);
  return {
    installed: true,
    valid: daysRemaining > 0,
    type: doc.type,
    licenceId: doc.licenceId,
    customer: doc.customer,
    issuedAt: doc.issuedAt,
    activatedAt: doc.activatedAt,
    expiresAt: doc.expiresAt,
    maxControllers: doc.maxControllers,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

async function status() {
  const doc = await Licence.findOne({ key: 'active' }).lean();
  return toStatus(doc);
}

async function isValid() {
  const doc = await Licence.findOne({ key: 'active' }).lean();
  return doc ? licenceCrypto.daysRemaining(doc.expiresAt) > 0 : false;
}

/**
 * Self-issued, no signature needed — it's the app granting itself a trial,
 * not a vendor-delivered license. Refuses to reset the clock on top of an
 * already-active license (demo or paid); only allowed when unset or expired.
 */
async function activateDemo(installedBy) {
  const existing = await Licence.findOne({ key: 'active' }).lean();
  if (existing && licenceCrypto.daysRemaining(existing.expiresAt) > 0) {
    return { ok: false, reason: 'Une licence valide est déjà active' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEMO_DAYS * 86400000);
  const doc = await Licence.findOneAndUpdate(
    { key: 'active' },
    {
      $set: {
        type: 'demo',
        licenceId: crypto.randomUUID(),
        customer: 'Démo',
        issuedAt: now,
        activatedAt: now,
        expiresAt,
        maxControllers: null,
        document: null,
        installedAt: now,
        installedBy,
      },
    },
    { new: true, upsert: true }
  );
  return { ok: true, status: toStatus(doc) };
}

/** Verifies signature + expiry, then installs the uploaded license. */
async function install(rawDocument, installedBy) {
  const verified = licenceCrypto.verify(rawDocument);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const { payload } = verified;
  const daysRemaining = licenceCrypto.daysRemaining(payload.expiresAt);
  if (daysRemaining <= 0) {
    return {
      ok: false,
      reason: `Cette licence a expiré le ${new Date(payload.expiresAt).toLocaleDateString('fr-FR')}`,
    };
  }

  const now = new Date();
  const doc = await Licence.findOneAndUpdate(
    { key: 'active' },
    {
      $set: {
        type: 'licensed',
        licenceId: payload.licenceId,
        customer: payload.customer,
        issuedAt: payload.issuedAt,
        activatedAt: now,
        expiresAt: payload.expiresAt,
        maxControllers: payload.maxControllers ?? null,
        document: rawDocument,
        installedAt: now,
        installedBy,
      },
    },
    { new: true, upsert: true }
  );
  return { ok: true, status: toStatus(doc) };
}

module.exports = { status, isValid, activateDemo, install };
