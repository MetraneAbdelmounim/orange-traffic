const licenceService = require('./licenceService');
const asyncHandler = require('../middlewares/asyncHandler');

const MAX_UPLOAD_BYTES = 64 * 1024;

module.exports = {
  getStatus: asyncHandler(async (_req, res) => {
    return res.status(200).json(await licenceService.status());
  }),

  activateDemo: asyncHandler(async (req, res) => {
    const result = await licenceService.activateDemo(req.member.username);
    if (!result.ok) return res.status(409).json({ error: result.reason });
    return res.status(200).json({ message: 'Licence démo activée', licence: result.status });
  }),

  install: asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    if (req.file.size > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'Fichier de licence trop volumineux' });
    }

    let document;
    try {
      document = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Fichier de licence illisible' });
    }

    const result = await licenceService.install(document, req.member.username);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    return res.status(200).json({ message: 'Licence installée avec succès', licence: result.status });
  }),
};
