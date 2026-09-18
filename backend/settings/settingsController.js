const Settings = require('./settings');
const asyncHandler = require('../middlewares/asyncHandler');
const mailer = require('../notifications/mailer');
const retention = require('../controller/retention');

const WRITABLE = [
  'pollIntervalSeconds',
  'defaultSnmpCommunity',
  'historyRetentionDays',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUser',
  'smtpFromName',
  'smtpFromEmail',
];

function pick(body) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([k]) => WRITABLE.includes(k))
  );
}

module.exports = {
  getSettings: asyncHandler(async (_req, res) => {
    const settings = await Settings.load();
    return res.status(200).json(settings);
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const update = pick(req.body);

    // Convention: an empty string means "leave the stored password alone" —
    // the form never has to round-trip the real value to keep it unchanged.
    const smtpPass = typeof req.body?.smtpPass === 'string' ? req.body.smtpPass : '';
    if (smtpPass) {
      update.smtpPass = smtpPass;
      update.smtpPassSet = true;
    }

    const settings = await Settings.findByIdAndUpdate(
      'singleton',
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    if (update.historyRetentionDays !== undefined) {
      await retention.applyRetentionSetting(settings.historyRetentionDays);
    }

    return res.status(200).json(settings);
  }),

  /**
   * Applies the currently configured retention period right now, instead of
   * waiting for MongoDB's TTL sweep — deletes readings/alarm events older
   * than `historyRetentionDays`, it does not wipe everything.
   */
  clearHistoryNow: asyncHandler(async (_req, res) => {
    const settings = await Settings.load();
    const result = await retention.clearHistoryNow(settings.historyRetentionDays);
    return res.status(200).json(result);
  }),

  /**
   * Tests a candidate SMTP config before it's saved — same UX as
   * projet-youness's "Test SMTP connection". An empty `smtpPass` in the body
   * means "use the currently stored password", so an admin can test without
   * re-typing it once it's already set.
   */
  testMail: asyncHandler(async (req, res) => {
    const to = String(req.body?.to ?? '').trim() || req.member?.email;
    if (!to) {
      return res.status(400).json({ error: "Adresse e-mail de test manquante (renseignez votre e-mail dans votre profil, ou précisez `to`)" });
    }

    const candidate = pick(req.body);
    if (typeof req.body?.smtpPass === 'string' && req.body.smtpPass) {
      candidate.smtpPass = req.body.smtpPass;
    } else {
      const stored = await Settings.findById('singleton').select('+smtpPass').lean();
      candidate.smtpPass = stored?.smtpPass || '';
    }
    const merged = { ...(await Settings.load()).toObject(), ...candidate };

    const result = await mailer.verifyAndSend(merged, to);
    return res.status(result.ok ? 200 : 400).json(result);
  }),
};
