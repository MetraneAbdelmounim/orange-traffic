const zlib = require('zlib');
const { EJSON } = require('bson');
const mongoose = require('mongoose');
const asyncHandler = require('../middlewares/asyncHandler');
const Project = require('../project/project');
const Controller = require('../controller/controller');

const BACKUP_VERSION = 1;

// Every collection that makes up the app's state, dumped via the raw driver
// (not the Mongoose models) so `select: false` fields — Member.password,
// Settings.smtpPass — are captured too; a restored environment must be able
// to log in and send mail without an admin re-entering anything. `readings`/
// `alarmevents` are historical and can be large, but are included per the
// "move to another environment" requirement (client decision, 2026-09-26):
// nothing gets left behind.
const COLLECTIONS = ['members', 'projects', 'controllers', 'settings', 'alarmevents', 'readings', 'alertstates', 'licences'];

module.exports = {
  createBackup: asyncHandler(async (_req, res) => {
    const db = mongoose.connection.db;
    const collections = {};
    for (const name of COLLECTIONS) {
      collections[name] = await db.collection(name).find({}).toArray();
    }
    const payload = { version: BACKUP_VERSION, generatedAt: new Date().toISOString(), collections };
    const gz = zlib.gzipSync(Buffer.from(EJSON.stringify(payload), 'utf8'));

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="orange-traffic-${stamp}.bkp"`);
    return res.status(200).send(gz);
  }),

  /**
   * Restoring overwrites every collection above outright — only ever safe on
   * an environment nothing real has been configured on yet, so this refuses
   * to run the moment a project or controller already exists. Deliberately
   * NOT gated on Member: reaching this endpoint at all requires being
   * logged in as an admin, and every environment's very first admin is
   * created by the /setup wizard before anyone can sign in — so a lone
   * bootstrap member is expected on a "fresh" environment, not a sign it's
   * in real use. That member gets replaced by the backup's own members
   * below, same as everything else.
   */
  restoreBackup: asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier de sauvegarde manquant' });

    const [projectCount, controllerCount] = await Promise.all([
      Project.countDocuments(),
      Controller.countDocuments(),
    ]);
    if (projectCount > 0 || controllerCount > 0) {
      return res.status(409).json({
        error:
          "Restauration refusée : cet environnement contient déjà des données (projets ou contrôleurs). La restauration n'est possible que sur un environnement neuf.",
      });
    }

    let payload;
    try {
      const json = zlib.gunzipSync(req.file.buffer).toString('utf8');
      payload = EJSON.parse(json);
    } catch {
      return res.status(400).json({ error: 'Fichier de sauvegarde illisible ou corrompu' });
    }
    if (!payload || payload.version !== BACKUP_VERSION || typeof payload.collections !== 'object') {
      return res.status(400).json({ error: 'Format de sauvegarde non reconnu' });
    }

    const db = mongoose.connection.db;
    const restored = {};
    for (const name of COLLECTIONS) {
      const docs = Array.isArray(payload.collections[name]) ? payload.collections[name] : [];
      await db.collection(name).deleteMany({});
      if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
      restored[name] = docs.length;
    }
    return res.status(200).json({ restored });
  }),
};
