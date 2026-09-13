const mongoose = require('mongoose');

/**
 * Singleton document (`key: 'active'`) — installing a new license replaces
 * it outright rather than accumulating a history.
 */
const licenceSchema = mongoose.Schema(
  {
    key: { type: String, default: 'active', unique: true },
    type: { type: String, enum: ['demo', 'licensed'], required: true },
    licenceId: { type: String, required: true },
    customer: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    activatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    maxControllers: { type: Number, default: null },
    // The verbatim uploaded file for a real license; null for a self-issued demo.
    document: { type: mongoose.Schema.Types.Mixed, default: null },
    installedAt: { type: Date, default: Date.now },
    installedBy: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Licence', licenceSchema);
