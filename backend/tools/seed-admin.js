/**
 * Creates (or resets the password of) the first admin account.
 *
 * Usage:
 *   node tools/seed-admin.js <username> <password>
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/config');
const Member = require('../member/member');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: node tools/seed-admin.js <username> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(config.bdUrl);

  const hash = await bcrypt.hash(password, 12);
  const member = await Member.findOneAndUpdate(
    { username },
    {
      $set: {
        username,
        password: hash,
        isAdmin: true,
        actif: false,
        mustChangePassword: false,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`Admin account ready: ${member.username} (id ${member._id})`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
