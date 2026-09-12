const Project = require('./project');
const Member = require('../member/member');
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

  /** Only the projects the caller belongs to; admins see all. */
  getAllProjects: asyncHandler(async (req, res) => {
    const allowed = accessibleProjectIds(req.member);
    const filter = allowed === null ? {} : { _id: { $in: allowed } };
    const projects = await Project.find(filter).sort({ nom: 1 }).lean();
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
};
