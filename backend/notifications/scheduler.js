const cron = require('node-cron');
const { runAlertSweep } = require('./alertJob');

let running = false;

/** Skips a tick rather than overlapping if the previous sweep is still going. */
function guard() {
  return async () => {
    if (running) return;
    running = true;
    try {
      await runAlertSweep();
    } catch (err) {
      console.error('[alertJob] sweep failed:', err.message);
    } finally {
      running = false;
    }
  };
}

function start() {
  cron.schedule('*/5 * * * *', guard());
  console.log('[notifications] alert sweep scheduled every 5 minutes');
}

module.exports = { start };
