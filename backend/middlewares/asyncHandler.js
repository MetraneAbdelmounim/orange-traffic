/**
 * Wraps an async route handler so a rejected promise reaches Express' error
 * handler instead of becoming an unhandled rejection.
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
