import { Observable, EMPTY, fromEvent, timer } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';

export const REFRESH_INTERVAL_MS = 15_000;

/**
 * Emits a tick every `intervalMs` while the tab is visible, and stops
 * entirely (no wasted requests, no wasted SNMP polling downstream) when it
 * isn't — same mechanism as projet-youness's `refreshWhileVisible`
 * (`front-end/src/app/services/auto-refresh.ts` there), which this project
 * had no equivalent of. Pair with `exhaustMap` at the call site so a slow
 * response doesn't queue up overlapping requests.
 */
export function refreshWhileVisible(intervalMs = REFRESH_INTERVAL_MS): Observable<number> {
  return fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => !document.hidden),
    switchMap((visible) => (visible ? timer(intervalMs, intervalMs) : EMPTY))
  );
}
