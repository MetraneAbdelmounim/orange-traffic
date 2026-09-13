const bcrypt = require('bcrypt');
const Member = require('../member/member');
const asyncHandler = require('../middlewares/asyncHandler');
const { issueToken, expiresInSeconds } = require('../auth/tokens');
const config = require('../config/config');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/** Source of truth for "is the app configured": at least one admin exists. */
async function isConfigured() {
  return Boolean(await Member.exists({ isAdmin: true }));
}

module.exports = {
  isConfigured,

  getStatus: asyncHandler(async (_req, res) => {
    return res.status(200).json({ configured: await isConfigured() });
  }),

  /**
   * Creates the first administrator account. Public by necessity (no one can
   * be logged in yet), but re-checks server-side that the app is still
   * unconfigured before doing anything — the frontend's own check is only a
   * UX shortcut, never trusted for this decision.
   */
  createAdmin: asyncHandler(async (req, res) => {
    if (await isConfigured()) {
      return res.status(409).json({ error: "L'application est déjà configurée" });
    }

    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const confirmPassword = String(req.body?.confirmPassword ?? '');

    if (!username) {
      return res.status(400).json({ error: "Le nom d'utilisateur est requis" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
      });
    }

    const existing = await Member.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà pris' });
    }

    const member = await Member.create({
      username,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      isAdmin: true,
      actif: true,
      mustChangePassword: false,
    });

    return res.status(201).json({
      message: 'Compte administrateur créé avec succès',
      expiresIn: expiresInSeconds(config.token_expiration),
      memberId: member._id,
      isAdmin: member.isAdmin,
      mustChangePassword: member.mustChangePassword,
      token: issueToken(member),
    });
  }),
};
