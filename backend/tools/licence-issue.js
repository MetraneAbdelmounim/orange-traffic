/**
 * Issues a signed `.otlic` license file, using the private key produced by
 * licence-keygen.js. This never runs on the deployed server — it's a local
 * tool for whoever holds the private key to hand a customer a license file.
 *
 * Usage:
 *   node tools/licence-issue.js --customer "Orange Traffic" --months 12 [--stations 50] [--key path/to/licence-private-key.pem] [--out out.otlic]
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { canonicalize } = require('../licence/licenceCrypto');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      out[key] = value;
      if (value !== true) i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!args.customer || !args.months) {
  console.error('Usage: node tools/licence-issue.js --customer "Name" --months 12 [--stations 50] [--key path.pem] [--out out.otlic]');
  process.exit(1);
}

const keyPath = args.key || path.join(__dirname, '../config/licence-private-key.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`Private key not found at ${keyPath}. Run licence-keygen.js first, or pass --key.`);
  process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));

const issuedAt = new Date();
const expiresAt = new Date(issuedAt);
expiresAt.setMonth(expiresAt.getMonth() + Number(args.months));

const payload = {
  licenceId: crypto.randomUUID(),
  customer: String(args.customer),
  issuedAt: issuedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  maxControllers: args.stations ? Number(args.stations) : null,
};

const signature = crypto.sign(null, canonicalize(payload), privateKey).toString('base64');
const document = { version: 1, payload, signature };

const outPath = args.out || `${payload.customer.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.otlic`;
fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
console.log(`License written to ${outPath}`);
console.log(`  customer:   ${payload.customer}`);
console.log(`  expires:    ${payload.expiresAt}`);
console.log(`  stations:   ${payload.maxControllers ?? 'unlimited'}`);
