const mongoose = require('mongoose');

const projectSchema = mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

/**
 * Cascade on delete: drop the project's controllers, their readings and
 * alarm events, and its membership references — mirrors the pattern used for
 * Site/Reading in the reference MPPT platform.
 */
projectSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
  try {
    const project = await this.model.findOne(this.getFilter()).lean();
    if (!project) return next();

    // Required lazily: these models reference Project, so importing at module
    // scope would create a require cycle.
    const Controller = require('../controller/controller');
    const Reading = require('../controller/reading');
    const AlarmEvent = require('../controller/alarmEvent');
    const Member = require('../member/member');

    await Promise.all([
      Controller.deleteMany({ project: project._id }),
      Reading.deleteMany({ 'meta.project': project._id }),
      AlarmEvent.deleteMany({ project: project._id }),
      Member.updateMany({ projects: project._id }, { $pull: { projects: project._id } }),
    ]);

    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model('Project', projectSchema);
