import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AlarmEvent } from '../../models/alarm-event';

@Injectable({ providedIn: 'root' })
export class AlarmEventService {
  constructor(private http: HttpClient) {}

  getByController(controllerId: string, limit = 100): Observable<AlarmEvent[]> {
    return this.http.get<AlarmEvent[]>(`/api/controllers/events/${controllerId}`, {
      params: { limit: String(limit) },
    });
  }
}
