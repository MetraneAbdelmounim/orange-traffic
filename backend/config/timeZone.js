/**
 * Fixed IANA timezone every server-rendered date/time (alert emails, PDF
 * report dates generated server-side, licence-expiry messages) is formatted
 * in — matches front-end/src/app/core/time-zone.ts and the `TZ` environment
 * variable already set on the app/poller containers (backend/docker-compose.yml).
 * Passed explicitly rather than relying solely on the container's `TZ` env
 * var so formatting stays correct even if that env var is ever missing.
 */
module.exports = { APP_TIME_ZONE: 'America/Toronto' };
