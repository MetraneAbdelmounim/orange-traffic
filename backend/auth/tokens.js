const jwt = require('jsonwebtoken');
const config = require('../config/config');

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

module.exports = { issueToken, expiresInSeconds };
