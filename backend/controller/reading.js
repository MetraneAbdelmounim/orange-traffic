const mongoose = require('mongoose');

/**
 * Historical SNMP telemetry, one document per successful sweep.
 *
 * Stored as a MongoDB time-series collection: readings are written once and
 * only ever queried by controller over a time range. Documents expire after
 * READING_RETENTION_DAYS so the collection stays bounded without a cleanup job.
 */
const RETENTION_DAYS = Number(process.env.READING_RETENTION_DAYS) || 90;

const readingSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    meta: {
      controller: { type: mongoose.Schema.Types.ObjectId, ref: 'Controller', required: true },
      project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    },
    reachable: Boolean,
    unitAlarmStatus1: Number,
    unitAlarmStatus2: Number,
    shortAlarmStatus: Number,
    activeFlags: [String],
  },
  {
    timeseries: {
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes',
    },
    expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60,
    versionKey: false,
  }
);

module.exports = mongoose.model('Reading', readingSchema);
