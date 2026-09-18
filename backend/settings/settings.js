const mongoose = require('mongoose');
const config = require('../config/config');

/**
 * Singleton document holding operator-editable toggles that must survive a
 * restart. Only one document ever exists (`_id: 'singleton'`).
 */
const settingsSchema = mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    pollIntervalSeconds: { type: Number, default: () => config.pollIntervalSeconds },
    defaultSnmpCommunity: { type: String, default: () => config.defaultSnmpCommunity },

    // How long history (readings for the charts) and the alarm journal are
    // kept before MongoDB's TTL sweep deletes them automatically — see
    // controller/retention.js, which keeps the DB's actual TTL in sync
    // whenever this changes.
    historyRetentionDays: { type: Number, default: 90 },

    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpSecure: { type: Boolean, default: false },
    smtpUser: { type: String, default: '' },
    // Never returned by a default query — same guarantee as Member.password.
    smtpPass: { type: String, default: '', select: false },
    smtpPassSet: { type: Boolean, default: false },
    smtpFromName: { type: String, default: 'Orange Traffic' },
    smtpFromEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

settingsSchema.statics.load = async function () {
  const doc = await this.findByIdAndUpdate(
    'singleton',
    { $setOnInsert: { _id: 'singleton' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
