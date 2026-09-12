const mongoose = require('mongoose');

/**
 * One document per alarm-flag transition (appeared or cleared), derived by
 * the poller by diffing `activeFlags` between two consecutive sweeps.
 *
 * This is what gives an alarm *history* without depending on the NTCIP
 * event-log table, whose availability was never confirmed on this model.
 */
const alarmEventSchema = mongoose.Schema(
  {
    controller: { type: mongoose.Schema.Types.ObjectId, ref: 'Controller', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    flag: { type: String, required: true },
    sourceObject: {
      type: String,
      enum: ['unitAlarmStatus1', 'unitAlarmStatus2', 'shortAlarmStatus'],
      required: true,
    },
    state: { type: String, enum: ['active', 'cleared'], required: true },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

alarmEventSchema.index({ controller: 1, occurredAt: -1 });

module.exports = mongoose.model('AlarmEvent', alarmEventSchema);
