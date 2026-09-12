const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Member = require('../member/member');
const config = require('../config/config');
const asyncHandler = require('../middlewares/asyncHandler');

/** Parses a jsonwebtoken duration ("12h", "45m", 3600) into seconds. */
function expiresInSeconds(expiration) {
  if (typeof expiration === 'number') return expiration;
  const match = /^(\d+)([smhd])?$/.exec(String(expiration).trim());
  if (!match) return 12 * 3600;
  const value = Number(match[1]);
  return value * { s: 1, m: 60, h: 3600, d: 86400 }[match[2] || 's'];
}

function issueToken(member) {
  return jwt.sign(
    { userId: member._id, username: member.username },
    config.secret_token_key,
    { expiresIn: config.token_expiration }
  );
}

module.exports = {
  /**
   * Authenticates a member.
   *
   * The response deliberately does not distinguish "unknown user" from "wrong
   * password", and the username is coerced to a string so an object such as
   * `{"$ne": null}` cannot be used as a query operator.
   */
  login: asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? '');
    const password = String(req.body?.password ?? '');

    const invalid = () => res.status(401).json({ error: 'Identifiants invalides' });

    if (!username || !password) return invalid();

    const member = await Member.findOne({ username }).select('+password');
    if (!member) {
      // Equalise timing so a missing account is not distinguishable by latency.
      await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      return invalid();
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) return invalid();

    await Member.updateOne({ _id: member._id }, { $set: { actif: true } });

    return res.status(200).json({
      message: 'Authentification réussie',
      expiresIn: expiresInSeconds(config.token_expiration),
      memberId: member._id,
      isAdmin: member.isAdmin,
      mustChangePassword: member.mustChangePassword,
      token: issueToken(member),
    });
  }),

  getCurrentMember: asyncHandler(async (req, res) => {
    const member = await Member.findById(req.member._id).populate('projects');
    if (!member) return res.status(401).json({ error: 'Utilisateur introuvable' });

    await Member.updateOne({ _id: member._id }, { $set: { actif: true } });
    return res.status(200).json({ message: 'authorized', member: member.toJSON() });
  }),

  logoutMember: asyncHandler(async (req, res) => {
    await Member.updateOne({ _id: req.member._id }, { $set: { actif: false } });
    return res.status(200).json({ message: "L'utilisateur a été déconnecté avec succès !" });
  }),
};
