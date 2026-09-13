const mongoose = require('mongoose');

/**
 * One document per controller, tracking the last alert notification sent for
 * it — lets the sweep tell "still the same ongoing problem, don't re-notify
 * within the cooldown" apart from "something changed, notify again now".
 */
const alertStateSchema = mongoose.Schema(
  {
    controller: { type: mongoose.Schema.Types.ObjectId, ref: 'Controller', required: true, unique: true },
    // A stable string encoding of "what was wrong" last time we notified —
    // an unchanged snapshot means the same ongoing condition; any change
    // (new alarm, cleared alarm, went offline) makes the next sweep due
    // immediately regardless of the cooldown.
    flagsSnapshot: { type: String, default: '' },
    lastNotifiedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlertState', alertStateSchema);
