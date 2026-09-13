const licenceService = require('../licence/licenceService');

/**
 * Blocks business endpoints when there is no valid license — a 402 with a
 * stable `code` the frontend can act on, not just a hidden UI state. Mirrors
 * projet-youness's licenceGuard: applied to the actual work (projects,
 * controllers, members, settings), never to /api/auth or /api/licence
 * themselves, so an admin can always sign in and upload a replacement.
 */
module.exports = async (req, res, next) => {
  const status = await licenceService.status();
  if (status.valid) return next();
  return res.status(402).json({
    error: status.installed ? 'Licence expirée' : 'Aucune licence installée',
    code: status.installed ? 'LICENCE_EXPIRED' : 'LICENCE_MISSING',
    ...status,
  });
};
