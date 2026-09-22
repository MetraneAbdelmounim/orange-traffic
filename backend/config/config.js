require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Reads a required environment variable.
 * In production a missing value is fatal — we refuse to boot with a default
 * secret rather than silently accepting forgeable tokens.
 */
function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(
      `Missing required environment variable ${name}. See backend/.env.example.`
    );
  }
  console.warn(`⚠️  ${name} is not set — using a development-only fallback.`);
  return devFallback;
}

function list(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = {
  isProduction,

  HOST: process.env.HOST || '127.0.0.1',
  PORT: Number(process.env.PORT) || 5000,

  bdUrl:
    process.env.MONGO_URL ||
    (isProduction
      ? 'mongodb://mongo:27017/orangetraffic'
      : 'mongodb://127.0.0.1:27017/orangetraffic'),

  secret_token_key: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  token_expiration: process.env.JWT_EXPIRATION || '12h',

  // Python SNMP polling service
  PORT_PY: Number(process.env.PORT_PY) || 8000,
  HOST_PY: process.env.HOST_PY || (isProduction ? 'poller' : '127.0.0.1'),

  // Origins allowed to call the API. Same-origin deployments need none.
  corsOrigins: list('CORS_ORIGINS', isProduction ? [] : ['http://localhost:4200']),

  /**
   * How often the Python poller sweeps every controller.
   * Owned by the poller (backend/python/config.py reads the same variable), but
   * needed here too so the UI can tell "stale" apart from "just polled".
   */
  pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS) || 60,

  readingRetentionDays: Number(process.env.READING_RETENTION_DAYS) || 90,

  defaultSnmpCommunity: process.env.DEFAULT_SNMP_COMMUNITY || 'public',
};
