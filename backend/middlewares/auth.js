const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/config');
const Member = require('../member/member');

const UNAUTHORIZED = "Vous n'êtes pas autorisé ! Veuillez contacter votre administrateur";

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length < 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Verifies the JWT and loads the current member from the database.
 *
 * The member is re-read on every request rather than trusted from the token
 * payload, so revoking a role or deleting an account takes effect immediately
 * instead of when the token eventually expires.
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: UNAUTHORIZED });

    const decoded = jwt.verify(token, config.secret_token_key);
    if (!decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ error: UNAUTHORIZED });
    }

    const member = await Member.findById(decoded.userId).select('+password');
    if (!member) return res.status(401).json({ error: UNAUTHORIZED });

    req.member = member;
    return next();
  } catch {
    return res.status(401).json({ error: UNAUTHORIZED });
  }
}

/** Requires the authenticated member to be an admin, per the database. */
function requireAdmin(req, res, next) {
  if (!req.member || !req.member.isAdmin) {
    return res.status(403).json({ error: UNAUTHORIZED });
  }
  return next();
}

/**
 * Blocks everything except the escape hatch (changing your own password)
 * while a temporary password is still in effect. This is the real
 * enforcement point — a frontend redirect alone would only be a UX nicety
 * that a direct API call or URL edit could bypass.
 */
function requirePasswordChanged(req, res, next) {
  if (req.member?.mustChangePassword) {
    return res.status(403).json({
      error: 'Vous devez changer votre mot de passe avant de continuer',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
  return next();
}

/**
 * Requires the target member in `req.params[param]` to be the caller.
 * Admins are allowed through so they can administer other accounts.
 */
function requireSelfOrAdmin(param = 'idMember') {
  return (req, res, next) => {
    const targetId = req.params[param];
    if (!req.member) return res.status(401).json({ error: UNAUTHORIZED });
    if (req.member.isAdmin || req.member._id.toString() === String(targetId)) {
      return next();
    }
    return res.status(403).json({ error: UNAUTHORIZED });
  };
}

/**
 * Requires the caller to be a member of the project identified by
 * `req.params[param]`, `req.query[param]`, or `req.body[param]`.
 * Admins have access to every project.
 *
 * The resolved id is left on `req.projectId` so controllers filter by a value
 * that has actually been authorized rather than re-reading raw input.
 */
function requireProjectAccess(param = 'idProject') {
  return (req, res, next) => {
    const projectId = req.params[param] ?? req.query[param] ?? req.body?.[param];

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Identifiant de projet invalide ou manquant' });
    }
    if (!req.member) return res.status(401).json({ error: UNAUTHORIZED });

    const allowed =
      req.member.isAdmin ||
      (req.member.projects || []).some((p) => p.toString() === String(projectId));

    if (!allowed) {
      return res.status(403).json({ error: "Vous n'êtes pas autorisé à accéder à ce projet" });
    }

    req.projectId = String(projectId);
    return next();
  };
}

/** Returns the set of project ids the caller may read, or null for admins (= all). */
function accessibleProjectIds(member) {
  if (!member || member.isAdmin) return null;
  return (member.projects || []).map((p) => p.toString());
}

module.exports = {
  authenticate,
  requireAdmin,
  requireSelfOrAdmin,
  requireProjectAccess,
  requirePasswordChanged,
  accessibleProjectIds,
  UNAUTHORIZED,
};
