import { Controller } from '../models/controller';

const MIN_COORD = 0.001;

/** (0,0) is the schema default for "not set" — never a real controller location. */
export function hasCoordinates(c: Pick<Controller, 'latitude' | 'longitude'>): boolean {
  return (
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    Math.abs(c.latitude) <= 90 &&
    Math.abs(c.longitude) <= 180 &&
    !(Math.abs(c.latitude) < MIN_COORD && Math.abs(c.longitude) < MIN_COORD)
  );
}

/** Opens Google Maps' Street View pegged to the controller's coordinates. */
export function streetViewUrl(c: Pick<Controller, 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps?layer=c&cbll=${c.latitude},${c.longitude}`;
}

/** The ATC-1500's own web UI (distinct from this app's internal detail page). */
export function controllerUiUrl(c: Pick<Controller, 'ip'>): string {
  return `https://${c.ip}:999/`;
}

/**
 * The field modem's login page. Deliberately just the link — the modem
 * admin password must not be hardcoded into the frontend bundle, which this
 * app serves publicly (unauthenticated) before the login check runs.
 */
export function modemUiUrl(c: Pick<Controller, 'ip'>): string {
  return `http://${c.ip}/login`;
}
