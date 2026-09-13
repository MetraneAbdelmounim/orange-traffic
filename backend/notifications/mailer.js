const nodemailer = require('nodemailer');
const Settings = require('../settings/settings');

// Belt and braces: nodemailer's connectionTimeout/greetingTimeout/socketTimeout
// only bound the phases *after* a TCP connection attempt starts — a hostname
// that fails DNS resolution (e.g. a typo'd SMTP host) was observed to hang
// verify()/sendMail() indefinitely regardless of those options. Without this
// hard wrapper, a bad host entered once would permanently wedge the alert
// scheduler: its overlap guard sets `running = true` before awaiting the
// sweep and only clears it in a `finally`, so a promise that never settles
// means every future tick is silently skipped forever.
const HARD_TIMEOUT_MS = 10000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Délai dépassé (${ms / 1000}s) — hôte SMTP injoignable`)), ms);
  });
  // If `promise` is still the loser when the race settles and later rejects
  // on its own (e.g. verify() finally erroring out after we'd already given
  // up on it), that rejection would otherwise have no listener attached.
  promise.catch(() => {});
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * No cached transporter, unlike projet-youness's mailer — this app's mail
 * volume (a handful of alert sweeps a day, occasional test-mail clicks)
 * doesn't justify the cache-invalidation-on-settings-change machinery that
 * buys. Every call rebuilds a transporter from the config it's given.
 */
function buildTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: Boolean(cfg.smtpSecure),
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

function fromHeader(cfg) {
  return cfg.smtpFromEmail ? `"${cfg.smtpFromName || 'Orange Traffic'}" <${cfg.smtpFromEmail}>` : undefined;
}

/**
 * Verifies a candidate config and, if `to` is given, sends a real probe
 * email — used by the "Test SMTP connection" button. Never logs `cfg` (it
 * may carry a password); only the SMTP library's own error text is logged.
 */
async function verifyAndSend(cfg, to) {
  if (!cfg.smtpHost) return { ok: false, stage: 'connexion', message: 'Hôte SMTP manquant' };

  const transport = buildTransport(cfg);
  try {
    await withTimeout(transport.verify(), HARD_TIMEOUT_MS);
  } catch (err) {
    return { ok: false, stage: 'connexion', message: err.message };
  }

  if (!to) return { ok: true, stage: 'connexion', message: 'Connexion SMTP réussie' };

  try {
    await withTimeout(
      transport.sendMail({
        to,
        from: fromHeader(cfg) || cfg.smtpUser,
        subject: '[Orange Traffic] Test de configuration SMTP',
        html: '<p>Ceci est un e-mail de test envoyé depuis la page Réglages d’Orange Traffic.</p>',
      }),
      HARD_TIMEOUT_MS
    );
    return { ok: true, stage: 'envoi', message: `E-mail de test envoyé à ${to}` };
  } catch (err) {
    return { ok: false, stage: 'envoi', message: err.message };
  }
}

/**
 * Sends using the currently stored settings. Returns `false` on failure
 * rather than throwing — callers (the alert sweep) use that to decide
 * whether to record "notified" state, so an SMTP outage gets retried on the
 * next sweep instead of silently swallowing the alert.
 */
async function send({ to, subject, html, attachments }) {
  const cfg = await Settings.findById('singleton').select('+smtpPass').lean();
  if (!cfg?.smtpHost) {
    console.error('[mailer] SMTP not configured — dropping email', { subject });
    return false;
  }

  try {
    const transport = buildTransport(cfg);
    await withTimeout(
      transport.sendMail({ to, from: fromHeader(cfg) || cfg.smtpUser, subject, html, attachments }),
      HARD_TIMEOUT_MS
    );
    return true;
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return false;
  }
}

module.exports = { verifyAndSend, send };
