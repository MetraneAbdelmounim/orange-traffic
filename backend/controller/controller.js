const mongoose = require('mongoose');

/**
 * Latest known SNMP/NTCIP status for a controller.
 *
 * `measuredAt`/`reachable` make a stale or failed poll distinguishable from a
 * genuine "all clear" — a controller that could not be reached stores
 * `reachable: false` rather than silently keeping the last known values.
 *
 * `activeFlags` is always an array, decoded from the raw bitmasks below. It is
 * the direct translation of the "decode whenever a value is non-zero" rule:
 * the UI never shows a bare integer, only human-readable flag names, with the
 * raw ints kept alongside for diagnostics.
 */
const snapshotSchema = new mongoose.Schema(
  {
    reachable: { type: Boolean, default: false },
    measuredAt: { type: Date, default: null },
    error: { type: String, default: null },

    sysDescr: { type: String, default: null },
    sysUpTimeTicks: { type: Number, default: null },

    unitAlarmStatus1: { type: Number, default: null },
    unitAlarmStatus2: { type: Number, default: null },
    shortAlarmStatus: { type: Number, default: null },
    activeFlags: { type: [String], default: [] },
    // Structured version of activeFlags: one entry per active bit, carrying
    // the NTCIP object it came from and its client-defined criticality tier
    // (only shortAlarmStatus bit 7 is "critical", everything else "warning")
    // — lets the UI render severity without re-deriving it from the label text.
    alarms: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Best-effort NTCIP 1202 object groups. Structure documented by the
    // standard but not confirmed supported on every ATC-1500 firmware — the
    // poller stores null rather than failing the whole sweep when these
    // branches time out.
    phaseStatus: { type: mongoose.Schema.Types.Mixed, default: null },
    detectorStatus: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const controllerSchema = mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    nom: { type: String, required: true, trim: true },
    ip: { type: String, required: true, unique: true, trim: true },
    port: { type: Number, default: 161 },
    community: { type: String, default: 'public', select: false },
    model: { type: String, default: 'ATC-1500', trim: true },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },

    lastSnapshot: { type: snapshotSchema, default: () => ({}) },

    // Reachability summary, refreshed by the poller on every sweep.
    status: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

controllerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.community;
    return ret;
  },
});

module.exports = mongoose.model('Controller', controllerSchema);
