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
