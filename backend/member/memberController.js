const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Member = require('./member');
const asyncHandler = require('../middlewares/asyncHandler');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/** Fields a client is allowed to set. Everything else in the body is ignored. */
const CREATABLE = ['username', 'isAdmin', 'projects'];
const UPDATABLE = ['isAdmin', 'projects'];

function pick(body, allowed) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(([k]) => allowed.includes(k))
  );
}

module.exports = {
  /**
   * Creates an account with a random one-time password, shown once to the
   * admin. The member is flagged to change it on first login.
   */
  addMember: asyncHandler(async (req, res) => {
    const data = pick(req.body, CREATABLE);
    if (!data.username) {
      return res.status(400).json({ error: "Le nom d'utilisateur est requis" });
    }

    const existing = await Member.findOne({ username: data.username });
    if (existing) {
      return res.status(409).json({ error: 'Utilisateur déjà existant !' });
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const member = await Member.create({
      ...data,
      password: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
      actif: false,
      mustChangePassword: true,
    });

    return res.status(201).json({
      message: 'Un compte utilisateur a été créé avec succès !',
      member: member.toJSON(),
      // Shown once to the administrator; never stored in clear.
      temporaryPassword,
    });
  }),

  getAllMembers: asyncHandler(async (req, res) => {
    const members = await Member.find({}).populate('projects').lean();
    members.forEach((m) => delete m.password);
    return res.status(200).json(members);
  }),

  deleteMember: asyncHandler(async (req, res) => {
    const result = await Member.deleteOne({ _id: req.params.idMember });
    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    return res.status(200).json({ message: "L'utilisateur a été supprimé avec succès" });
  }),

  updateMember: asyncHandler(async (req, res) => {
    const member = await Member.findByIdAndUpdate(
      req.params.idMember,
      { $set: pick(req.body, UPDATABLE) },
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res
      .status(200)
      .json({ message: "L'utilisateur a été modifié avec succès !", member: member.toJSON() });
  }),

  /**
   * Changes a password. The route restricts the target to the caller (or an
   * admin); a non-admin must also prove knowledge of the current password, so a
   * borrowed session cannot lock the real owner out.
   */
  changePassword: asyncHandler(async (req, res) => {
    const { currentPass, newPass, confirmedPass } = req.body || {};

    if (!newPass || newPass !== confirmedPass) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }
    if (newPass.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
      });
    }

    const member = await Member.findById(req.params.idMember).select('+password');
    if (!member) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const isSelf = req.member._id.toString() === member._id.toString();
    if (isSelf) {
      const valid = currentPass && (await bcrypt.compare(currentPass, member.password));
      if (!valid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
    }

    member.password = await bcrypt.hash(newPass, BCRYPT_ROUNDS);
    member.mustChangePassword = false;
    await member.save();

    return res.status(200).json({ message: 'Votre mot de passe a été modifié avec succès !' });
  }),
};
