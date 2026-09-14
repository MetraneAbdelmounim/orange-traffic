const axios = require('axios').default;
const config = require('../config/config');
const Controller = require('./controller');
const Reading = require('./reading');
const AlarmEvent = require('./alarmEvent');
const asyncHandler = require('../middlewares/asyncHandler');
const { accessibleProjectIds } = require('../middlewares/auth');
const { flagsKey } = require('./flagsKey');

const PY_BASE = `http://${config.HOST_PY}:${config.PORT_PY}`;
const CONTROL_TIMEOUT_MS = Number(process.env.CONTROL_TIMEOUT_MS) || 15000;

/** Fields a client may set on a controller. */
const WRITABLE = ['ip', 'nom', 'port', 'community', 'model', 'latitude', 'longitude', 'project'];

function pick(body, allowed) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([k]) => allowed.includes(k))
  );
}

/** Restricts a query to the projects the caller may read. */
function scopeToMember(filter, member) {
  const allowed = accessibleProjectIds(member);
  if (allowed === null) return filter; // admin
  return { ...filter, project: { $in: allowed } };
}

/** An ack is only still valid while it matches the controller's current alarm condition. */
function withAcknowledged(c) {
  const acknowledged = !!c.acknowledgment?.flagsSnapshot && c.acknowledgment.flagsSnapshot === flagsKey(c);
  return { ...c, acknowledged };
}

module.exports = {
  addController: asyncHandler(async (req, res) => {
    const data = pick(req.body, WRITABLE);
    if (!data.community) data.community = config.defaultSnmpCommunity;
    const controller = await Controller.create(data);
    return res
      .status(201)
      .json({ message: 'Un nouveau contrôleur a été ajouté avec succès !', controller });
  }),

  updateController: asyncHandler(async (req, res) => {
    const controller = await Controller.findByIdAndUpdate(
      req.params.idController,
      { $set: pick(req.body, WRITABLE) },
      { new: true, runValidators: true }
    );
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });
    return res
      .status(200)
      .json({ message: 'Le contrôleur a été modifié avec succès !', controller });
  }),

  deleteController: asyncHandler(async (req, res) => {
    const result = await Controller.deleteOne({ _id: req.params.idController });
    if (!result.deletedCount) return res.status(404).json({ error: 'Contrôleur introuvable' });
    await Promise.all([
      AlarmEvent.deleteMany({ controller: req.params.idController }),
      // Time-series history is keyed by meta.controller — without this the
      // readings outlive the controller they belong to for up to
      // READING_RETENTION_DAYS, invisible orphans in the Reading collection.
      Reading.deleteMany({ 'meta.controller': req.params.idController }),
    ]);
    return res.status(200).json({ message: 'Le contrôleur a été supprimé avec succès' });
  }),

  /** Every controller of a project, with its latest decoded snapshot attached. */
  getControllersByProject: asyncHandler(async (req, res) => {
    const controllers = await Controller.find({ project: req.projectId })
      .populate('project')
      .sort({ nom: 1 })
      .lean();
    return res.status(200).json(controllers.map(withAcknowledged));
  }),

  /** Every controller the caller is allowed to see. */
  getAllControllers: asyncHandler(async (req, res) => {
    const controllers = await Controller.find(scopeToMember({}, req.member))
      .populate('project')
      .sort({ nom: 1 })
      .lean();
    return res.status(200).json(controllers.map(withAcknowledged));
  }),

  getControllerById: asyncHandler(async (req, res) => {
    const controller = await Controller.findOne(
      scopeToMember({ _id: req.params.idController }, req.member)
    )
      .populate('project')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });
    return res.status(200).json(withAcknowledged(controller));
  }),

  /**
   * Historical alarm readings for charting/timeline — what the time-series
   * collection exists for.
   */
  getHistoryByController: asyncHandler(async (req, res) => {
    const controller = await Controller.findOne(
      scopeToMember({ _id: req.params.idController }, req.member)
    )
      .select('_id')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });

    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 90);
    const from = new Date(Date.now() - hours * 3600 * 1000);

    const readings = await Reading.find({ 'meta.controller': controller._id, ts: { $gte: from } })
      .sort({ ts: 1 })
      .limit(5000)
      .lean();

    return res.status(200).json({
      intervalSeconds: config.pollIntervalSeconds,
      readings,
    });
  }),

  /** Alarm transition log — appeared/cleared flags, most recent first. */
  getAlarmEventsByController: asyncHandler(async (req, res) => {
    const controller = await Controller.findOne(
      scopeToMember({ _id: req.params.idController }, req.member)
    )
      .select('_id')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const events = await AlarmEvent.find({ controller: controller._id })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json(events);
  }),

  getStatusController: asyncHandler(async (req, res) => {
    const controller = await Controller.findOne(scopeToMember({ ip: req.params.ip }, req.member))
      .select('ip status lastSeenAt')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });
    return res.status(200).json({ alive: controller.status, lastSeenAt: controller.lastSeenAt });
  }),

  /**
   * Forces an immediate SNMP re-read of one controller, proxied to the
   * Python poller. Used by the UI's "Rafraîchir maintenant" button so an
   * operator does not have to wait up to POLL_INTERVAL_SECONDS.
   */
  pollController: asyncHandler(async (req, res) => {
    const controller = await Controller.findOne(
      scopeToMember({ _id: req.params.idController }, req.member)
    )
      .select('ip nom')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });

    try {
      const { data } = await axios.post(
        `${PY_BASE}/control/poll/${controller.ip}`,
        {},
        { timeout: CONTROL_TIMEOUT_MS }
      );
      return res.status(200).json(data);
    } catch (err) {
      console.error(`Immediate poll failed for ${controller.nom} (${controller.ip}):`, err.message);
      return res.status(502).json({ error: `Impossible de sonder ${controller.nom}` });
    }
  }),

  /**
   * Admin-only: fully suppresses this controller from alertJob's sweep and
   * switches its UI badge to a neutral "maintenance" state, regardless of
   * whatever alarms/reachability it actually reports underneath.
   */
  setMaintenance: asyncHandler(async (req, res) => {
    const enabled = !!req.body.enabled;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
    const controller = await Controller.findByIdAndUpdate(
      req.params.idController,
      {
        $set: {
          maintenanceMode: enabled,
          maintenance: enabled ? { note, by: req.member.username, at: new Date() } : { note: null, by: null, at: null },
        },
      },
      { new: true }
    )
      .populate('project')
      .lean();
    if (!controller) return res.status(404).json({ error: 'Contrôleur introuvable' });
    return res.status(200).json(withAcknowledged(controller));
  }),

  /**
   * Any member with access to the controller's project may acknowledge —
   * this is a visibility/workflow aid, not an admin permission, and does not
   * affect alert emails (those keep following their own 12h cooldown).
   */
  setAcknowledgment: asyncHandler(async (req, res) => {
    const acknowledged = !!req.body.acknowledged;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : null;

    const existing = await Controller.findOne(scopeToMember({ _id: req.params.idController }, req.member)).lean();
    if (!existing) return res.status(404).json({ error: 'Contrôleur introuvable' });

    const controller = await Controller.findByIdAndUpdate(
      req.params.idController,
      {
        $set: {
          acknowledgment: acknowledged
            ? { flagsSnapshot: flagsKey(existing), note, by: req.member.username, at: new Date() }
            : { flagsSnapshot: null, note: null, by: null, at: null },
        },
      },
      { new: true }
    )
      .populate('project')
      .lean();
    return res.status(200).json(withAcknowledged(controller));
  }),
};
