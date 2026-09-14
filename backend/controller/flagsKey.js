/**
 * A string identifying "the current alarm condition" of a controller —
 * sorted active alarm labels, prefixed with OFFLINE when unreachable.
 *
 * Shared between alertJob.js (a changed key means a new condition worth
 * re-notifying about) and the acknowledgment workflow (an ack is only valid
 * while this key still matches what it was acknowledged against) so the two
 * features can never disagree about what counts as "the same condition".
 */
function flagsKey(c) {
  const labels = (c.lastSnapshot?.alarms || []).map((a) => a.label).sort();
  return (c.status ? [] : ['OFFLINE']).concat(labels).join('|');
}

module.exports = { flagsKey };
