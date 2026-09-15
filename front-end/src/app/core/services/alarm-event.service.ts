import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AlarmEvent } from '../../models/alarm-event';

@Injectable({ providedIn: 'root' })
export class AlarmEventService {
  constructor(private http: HttpClient) {}

  /**
   * `hours` bounds the query to a time window (e.g. the alarm timeline's
   * currently selected period) instead of relying on `limit` alone, which
   * can't guarantee every transition in a long window is included for a
   * busy controller.
   */
  getByController(controllerId: string, opts: { limit?: number; hours?: number } = {}): Observable<AlarmEvent[]> {
    const params: Record<string, string> = { limit: String(opts.limit ?? 100) };
    if (opts.hours) params['hours'] = String(opts.hours);
    return this.http.get<AlarmEvent[]>(`/api/controllers/events/${controllerId}`, { params });
  }
}
