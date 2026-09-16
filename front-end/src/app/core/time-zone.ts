/**
 * Fixed IANA timezone this platform always displays dates/times in —
 * regardless of the viewer's own browser/OS timezone. This is a
 * supervision tool for one specific deployment (the client's controllers in
 * Montreal), so every operator must read the same wall-clock time for the
 * same event, whether they're in the same city or connecting from anywhere
 * else. Matches the `TZ` environment variable set on the backend containers
 * (backend/docker-compose.yml) so the UI and the server logs always agree.
 *
 * Used both as Angular's app-wide `DatePipe` default (app.config.ts, covers
 * every `| date` pipe) and passed explicitly to every custom
 * `toLocaleString`/`toLocaleDateString` call, which Angular's default does
 * not reach.
 */
export const APP_TIME_ZONE = 'America/Toronto';
