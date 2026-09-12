const mongoose = require('mongoose');

const memberSchema = mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    // `select: false` keeps the hash out of every query that does not ask for it
    // explicitly, so it can never leak through a list endpoint.
    password: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, required: true, default: false },
    actif: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: true },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true }],
  },
  { timestamps: true }
);

// Belt and braces: even if a query selects the hash, it is stripped on the way out.
memberSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Member', memberSchema);
