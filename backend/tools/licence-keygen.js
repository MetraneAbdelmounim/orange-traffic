/**
 * Generates the Ed25519 keypair Orange Traffic uses to sign `.otlic` license
 * files. Run this ONCE per deployment lineage — regenerating it invalidates
 * every license already issued with the old key.
 *
 * The public key is committed (backend/config/licence-public-key.pem) so the
 * server can verify uploads; the private key is written next to it but must
 * be moved somewhere safe and OUT of the repo (used only by licence-issue.js
 * to mint real licenses later — never deployed to the server).
 *
 * Usage: node tools/licence-keygen.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PUBLIC_KEY_PATH = path.join(__dirname, '../config/licence-public-key.pem');
const PRIVATE_KEY_PATH = path.join(__dirname, '../config/licence-private-key.pem');

if (fs.existsSync(PUBLIC_KEY_PATH)) {
  console.error(`A key already exists at ${PUBLIC_KEY_PATH}. Delete it first if you really want to replace it — doing so invalidates every license issued so far.`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

fs.writeFileSync(PUBLIC_KEY_PATH, publicKey.export({ type: 'spki', format: 'pem' }));
fs.writeFileSync(PRIVATE_KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }));

console.log(`Public key written to  ${PUBLIC_KEY_PATH} (commit this).`);
console.log(`Private key written to ${PRIVATE_KEY_PATH} — move this OUT of the repo now (it is already gitignored, but keep it somewhere safe and never deploy it to the server). Delete the local copy once you have moved it.`);
