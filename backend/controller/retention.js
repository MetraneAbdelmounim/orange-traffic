const mongoose = require('mongoose');
const Reading = require('./reading');
const AlarmEvent = require('./alarmEvent');

const ALARM_EVENT_TTL_INDEX_NAME = 'occurredAt_ttl';
const MIN_DAYS = 1;
const DEFAULT_DAYS = 90;

function toSeconds(days) {
  const n = Math.max(MIN_DAYS, Math.round(Number(days) || DEFAULT_DAYS));
  return n * 24 * 60 * 60;
}

function toCutoffDate(days) {
  return new Date(Date.now() - toSeconds(days) * 1000);
}

/**
 * Keeps both history collections' automatic expiry in sync with the
 * admin-configured retention setting, so cleanup keeps happening on its own
 * (via MongoDB's background TTL sweep) without a cron job in this app.
 * `Reading` is a time-series collection created with `expireAfterSeconds` —
 * collMod adjusts it live. `AlarmEvent` has no TTL by default, so this
 * creates the index the first time and adjusts it on every later call.
 */
async function applyRetentionSetting(days) {
  const seconds = toSeconds(days);
  const db = mongoose.connection.db;

  await db.command({ collMod: Reading.collection.collectionName, expireAfterSeconds: seconds });

  const indexes = await AlarmEvent.collection.indexes();
  const existing = indexes.find((i) => i.name === ALARM_EVENT_TTL_INDEX_NAME);
  if (existing) {
    await db.command({
      collMod: AlarmEvent.collection.collectionName,
      index: { name: ALARM_EVENT_TTL_INDEX_NAME, expireAfterSeconds: seconds },
    });
  } else {
    await AlarmEvent.collection.createIndex(
      { occurredAt: 1 },
      { name: ALARM_EVENT_TTL_INDEX_NAME, expireAfterSeconds: seconds }
    );
  }
}

/**
 * Deletes anything older than the configured retention right now, instead of
 * waiting for MongoDB's background TTL sweep (which runs roughly once a
 * minute and isn't instantaneous) — this is what the admin's "clear
 * immediately" button calls.
 */
async function clearHistoryNow(days) {
  const cutoff = toCutoffDate(days);
  const [readings, events] = await Promise.all([
    Reading.deleteMany({ ts: { $lt: cutoff } }),
    AlarmEvent.deleteMany({ occurredAt: { $lt: cutoff } }),
  ]);
  return { readingsDeleted: readings.deletedCount, eventsDeleted: events.deletedCount, cutoff };
}

module.exports = { applyRetentionSetting, clearHistoryNow, DEFAULT_DAYS };
