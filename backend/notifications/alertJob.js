const Controller = require('../controller/controller');
const Member = require('../member/member');
const AlertState = require('./alertState');
const mailer = require('./mailer');
const { buildAlertEmail } = require('./emailTemplate');
const { accessibleProjectIds } = require('../middlewares/auth');
const { flagsKey } = require('../controller/flagsKey');

// 12h, matching projet-youness's default reminder interval — not exposed as
// a setting since the brief doesn't ask for one.
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

function worstCriticality(alarms) {
  if (alarms.some((a) => a.criticality === 'critical')) return 'critical';
  if (alarms.length > 0) return 'warning';
  return null;
}

/**
 * A controller is worth alerting on if it has any active alarm — orange
 * (warning) or red (critical) — or is unreachable. Green (no alarm, reachable)
 * never notifies. This is the single source of truth for "does this
 * controller need an email", shared with the project-grouping pass below so
 * the two can never drift apart.
 */
function isAffected(c) {
  const alarms = c.lastSnapshot?.alarms || [];
  return alarms.length > 0 || !c.status;
}

async function isDue(controllerId, currentKey) {
  const existing = await AlertState.findOne({ controller: controllerId }).lean();
  if (!existing) return true;
  if (existing.flagsSnapshot !== currentKey) return true;
  return Date.now() - new Date(existing.lastNotifiedAt).getTime() > COOLDOWN_MS;
}

async function recipientsForProject(projectId) {
  const members = await Member.find({ notifyOnCritical: true, email: { $ne: '' } })
    .select('email isAdmin projects')
    .lean();
  return members
    .filter((m) => {
      const allowed = accessibleProjectIds(m); // null = admin, unrestricted
      return allowed === null || allowed.includes(String(projectId));
    })
    .map((m) => m.email);
}

/**
 * One sweep: find controllers with a critical alarm or offline, group by
 * project, and — for any project where at least one such controller is due
 * (new condition, or past the cooldown) — send one email per recipient
 * covering every affected/alarmed controller in that project.
 */
async function runAlertSweep() {
  // Controllers under maintenance are fully excluded — never emailed about,
  // regardless of what their alarms/reachability look like.
  const controllers = await Controller.find({ maintenanceMode: { $ne: true } })
    .populate('project')
    .lean();

  // A controller that has recovered gets its dedup state cleared so a future
  // fault is treated as new rather than suppressed by a stale cooldown.
  const recoveredIds = controllers.filter((c) => !isAffected(c)).map((c) => c._id);
  if (recoveredIds.length) {
    await AlertState.deleteMany({ controller: { $in: recoveredIds } });
  }

  const byProject = new Map();
  for (const c of controllers) {
    if (!c.project) continue;
    if (!isAffected(c)) continue;
    const key = c.project._id.toString();
    if (!byProject.has(key)) byProject.set(key, { project: c.project, controllers: [] });
    byProject.get(key).controllers.push(c);
  }

  for (const { project, controllers: projectControllers } of byProject.values()) {
    const affected = projectControllers.filter(isAffected);
    const dueFlags = await Promise.all(affected.map((c) => isDue(c._id, flagsKey(c))));
    if (!dueFlags.some(Boolean)) continue;

    const recipients = await recipientsForProject(project._id);
    if (!recipients.length) continue;

    const entries = projectControllers.map((c) => ({
      nom: c.nom,
      ip: c.ip,
      lastSeenAt: c.lastSeenAt,
      offline: !c.status,
      worstCriticality: worstCriticality(c.lastSnapshot?.alarms || []),
      alarms: (c.lastSnapshot?.alarms || []).map((a) => ({ label: a.label, criticality: a.criticality })),
    }));

    const generatedAt = new Date().toLocaleString('fr-FR');
    const { html, attachments } = buildAlertEmail({ projectName: project.nom, generatedAt, controllers: entries });
    const isCritical = entries.some((e) => e.worstCriticality === 'critical');
    const subject = `[Orange Traffic] ${isCritical ? 'Alerte critique' : 'Alerte'} — ${project.nom}`;

    const results = await Promise.all(recipients.map((to) => mailer.send({ to, subject, html, attachments })));
    // At least one recipient must have actually received it before we record
    // "notified" — an all-failed send must be retried on the next sweep.
    if (!results.some(Boolean)) continue;

    const now = new Date();
    await Promise.all(
      affected.map((c) =>
        AlertState.findOneAndUpdate(
          { controller: c._id },
          { $set: { flagsSnapshot: flagsKey(c), lastNotifiedAt: now } },
          { upsert: true }
        )
      )
    );
  }
}

module.exports = { runAlertSweep };
