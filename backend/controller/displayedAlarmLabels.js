/**
 * Client decision (2026-09-26, revised 2026-10-05): of the 21 NTCIP bits
 * this app can decode, only these 9 are operationally relevant for *live*
 * state — the current-alarms box on the controller page, badge/count chips,
 * and SMTP notifications. `backend/python/decode.py` is intentionally NOT
 * filtered — Controller.lastSnapshot, Reading, and AlarmEvent all store the
 * complete, faithful decode, so the alarm journal/timeline keeps showing
 * everything the controller ever actually reported. This whitelist is
 * applied only where "live" state is read: see `filterAlarms`/`filterFlags`
 * below, used by controllerController.js (withDerivedFields),
 * projectController.js (alarmCount aggregation), and alertJob.js. Keep in
 * sync with the client's list if it ever changes.
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

/** Structured alarms ({label, criticality, ...}) restricted to the live whitelist. */
function filterAlarms(alarms) {
  return (alarms || []).filter((a) => DISPLAYED_ALARM_LABELS.has(a.label));
}

/** Flat flag-label strings restricted to the live whitelist. */
function filterFlags(flags) {
  return (flags || []).filter((f) => DISPLAYED_ALARM_LABELS.has(f));
}

module.exports = { DISPLAYED_ALARM_LABELS, filterAlarms, filterFlags };
