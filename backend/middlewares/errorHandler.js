const config = require('../config/config');

/**
 * Terminal error handler.
 *
 * Client-caused failures (validation, duplicate key, bad ObjectId) map to 4xx
 * with a short message; everything else is logged server-side and reported as a
 * generic 500 so driver internals and stack traces never reach the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies this by arity
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Données invalides',
      details: Object.fromEntries(
        Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
      ),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'valeur';
    return res.status(409).json({ error: `Cette ${field} existe déjà` });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Une erreur interne est survenue',
    ...(config.isProduction ? {} : { detail: err.message }),
  });
};
