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
