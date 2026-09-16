const mongoose = require('mongoose');
const Project = require('./project');
const Member = require('../member/member');
const Controller = require('../controller/controller');
const Reading = require('../controller/reading');
const AlarmEvent = require('../controller/alarmEvent');
const asyncHandler = require('../middlewares/asyncHandler');
const { accessibleProjectIds } = require('../middlewares/auth');

const WRITABLE = ['nom', 'description'];

function pick(body) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([k]) => WRITABLE.includes(k))
  );
}

module.exports = {
  addProject: asyncHandler(async (req, res) => {
    const project = await Project.create(pick(req.body));
    // Admins implicitly manage every project.
    await Member.updateMany({ isAdmin: true }, { $addToSet: { projects: project._id } });
    return res
      .status(201)
      .json({ message: 'Un nouveau projet a été ajouté avec succès !', project });
  }),

  /**
   * Only the projects the caller belongs to; admins see all. Enriched with
   * per-project controller counts (total / in alarm / unreachable) via a
   * single aggregation, so the projects list can show a live health summary
   * on every card without an extra round trip per project.
   */
  getAllProjects: asyncHandler(async (req, res) => {
    const allowed = accessibleProjectIds(req.member);
    const match =
      allowed === null ? {} : { _id: { $in: allowed.map((id) => new mongoose.Types.ObjectId(id)) } };

    const projects = await Project.aggregate([
      { $match: match },
      { $sort: { nom: 1 } },
      {
        $lookup: {
          from: 'controllers',
          localField: '_id',
          foreignField: 'project',
          as: 'controllers',
        },
      },
      {
        $addFields: {
          controllerCount: { $size: '$controllers' },
          // A controller under maintenance is excluded from both counts — it
          // still exists (controllerCount), it's just not "a problem" for
          // as long as maintenance is active.
          offlineCount: {
            $size: {
              $filter: {
                input: '$controllers',
                as: 'c',
                cond: {
                  $and: [{ $eq: ['$$c.status', false] }, { $ne: ['$$c.maintenanceMode', true] }],
                },
              },
            },
          },
          // Total *alarms*, not affected controllers — a single controller
          // with 3 simultaneous conditions counts as 3 here, matching what
          // the badge's label ("N en alarme") actually implies. Maintenance
          // controllers are excluded, same "full suppression" rule as the
          // other counts.
          alarmCount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$controllers',
                    as: 'c',
                    cond: { $ne: ['$$c.maintenanceMode', true] },
                  },
                },
                as: 'c',
                in: { $size: { $ifNull: ['$$c.lastSnapshot.activeFlags', []] } },
              },
            },
          },
          maintenanceCount: {
            $size: {
              $filter: {
                input: '$controllers',
                as: 'c',
                cond: { $eq: ['$$c.maintenanceMode', true] },
              },
            },
          },
        },
      },
      { $project: { controllers: 0 } },
    ]);

    return res.status(200).json(projects);
  }),

  getProjectByID: asyncHandler(async (req, res) => {
    const project = await Project.findById(req.projectId).lean();
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });
    return res.status(200).json(project);
  }),

  updateProject: asyncHandler(async (req, res) => {
    const project = await Project.findByIdAndUpdate(
      req.params.idProject,
      { $set: pick(req.body) },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });
    return res.status(200).json({ message: 'Le projet a été modifié avec succès !', project });
  }),

  deleteProject: asyncHandler(async (req, res) => {
    // deleteOne is used (not findByIdAndDelete) so the schema's cascade hook runs.
    const result = await Project.deleteOne({ _id: req.params.idProject });
    if (!result.deletedCount) return res.status(404).json({ error: 'Projet introuvable' });
    return res.status(200).json({ message: 'Le projet a été supprimé avec succès' });
  }),

  /**
   * Availability (%) and alarm frequency per controller over a trailing
   * window, for the project's KPI tab. Uptime comes from the Reading
   * time-series (one row per sweep, reachable or not — see store.py), never
   * from the capped/undersampled history endpoint. `total===0` (no rows in
   * the window — a brand-new controller, or data past the TTL) yields
   * `uptimePercent: null` rather than a misleading 0 or 100.
   */
  getProjectKpi: asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const projectId = new mongoose.Types.ObjectId(req.projectId);

    const controllers = await Controller.find({ project: req.projectId })
      .select('_id nom maintenanceMode')
      .sort({ nom: 1 })
      .lean();

    const [uptimeRows, alarmRows] = await Promise.all([
      Reading.aggregate([
        { $match: { 'meta.project': projectId, ts: { $gte: since } } },
        {
          $group: {
            _id: '$meta.controller',
            total: { $sum: 1 },
            up: { $sum: { $cond: ['$reachable', 1, 0] } },
          },
        },
      ]),
      AlarmEvent.aggregate([
        { $match: { project: projectId, state: 'active', occurredAt: { $gte: since } } },
        { $group: { _id: '$controller', count: { $sum: 1 } } },
      ]),
    ]);

    const uptimeById = new Map(uptimeRows.map((r) => [String(r._id), r]));
    const alarmCountById = new Map(alarmRows.map((r) => [String(r._id), r.count]));

    const rows = controllers.map((c) => {
      const u = uptimeById.get(String(c._id));
      const uptimePercent = u && u.total > 0 ? Math.round((u.up / u.total) * 1000) / 10 : null;
      return {
        controllerId: c._id,
        nom: c.nom,
        maintenanceMode: !!c.maintenanceMode,
        uptimePercent,
        alarmCount: alarmCountById.get(String(c._id)) || 0,
      };
    });

    const withUptime = rows.filter((r) => r.uptimePercent !== null);
    const avgUptimePercent = withUptime.length
      ? Math.round((withUptime.reduce((sum, r) => sum + r.uptimePercent, 0) / withUptime.length) * 10) / 10
      : null;
    const totalAlarmCount = rows.reduce((sum, r) => sum + r.alarmCount, 0);

    return res.status(200).json({
      days,
      generatedAt: new Date(),
      summary: { avgUptimePercent, totalAlarmCount, controllerCount: rows.length },
      controllers: rows,
    });
  }),
};
