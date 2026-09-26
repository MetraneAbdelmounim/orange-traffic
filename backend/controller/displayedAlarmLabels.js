/**
 * Client decision (2026-09-26): of the 21 NTCIP bits this app can decode,
 * only these 9 are operationally relevant. `backend/python/decode.py`'s
 * `DISPLAYED_LABELS` is the source of truth and already stops any other
 * label from ever being written to `Controller.lastSnapshot`, `Reading`, or
 * `AlarmEvent` going forward — but documents written before that filter was
 * added still carry the old, wider set of labels. This mirrors the same
 * whitelist so historical queries (the alarm journal and the charts) don't
 * surface them either, without having to delete that older data. Keep the
 * two lists in sync if the client's list ever changes.
 */
const DISPLAYED_ALARM_LABELS = new Set([
  'Local Flash - entrée Local Flash active',
  'MMU Flash - entrée MMU Flash active trop longtemps',
  'Cycle Fail - défaut de cycle',
  'Stop Time - entrée Stop Time active',
  'Response Fault - défaut de réponse NEMA TS2 Port 1',
  'Low Battery - tension batterie trop faible',
  'Critical Alarm - Stop Time actif',
  'Coordination Alarm - problème de coordination',
  'T&F Flash - Local Flash ou MMU Flash actif',
]);

module.exports = { DISPLAYED_ALARM_LABELS };
