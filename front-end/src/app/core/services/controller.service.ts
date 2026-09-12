import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Controller, ControllerHistory } from '../../models/controller';

@Injectable({ providedIn: 'root' })
export class ControllerService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Controller[]> {
    return this.http.get<Controller[]>('/api/controllers/ping');
  }

  getByProject(projectId: string): Observable<Controller[]> {
    return this.http.get<Controller[]>(`/api/controllers/projects/${projectId}`);
  }

  getById(id: string): Observable<Controller> {
    return this.http.get<Controller>(`/api/controllers/${id}`);
  }

  add(data: Partial<Controller> & { community?: string }): Observable<{ controller: Controller }> {
    return this.http.post<{ controller: Controller }>('/api/controllers', data);
  }

  update(
    id: string,
    data: Partial<Controller> & { community?: string }
  ): Observable<{ controller: Controller }> {
    return this.http.put<{ controller: Controller }>(`/api/controllers/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/controllers/${id}`);
  }

  getHistory(id: string, hours = 24): Observable<ControllerHistory> {
    return this.http.get<ControllerHistory>(`/api/controllers/history/${id}`, {
      params: { hours: String(hours) },
    });
  }

  /** Forces an immediate SNMP re-read via the Python poller. */
  pollNow(id: string): Observable<{ success: boolean; status: boolean; lastSeenAt: string | null }> {
    return this.http.post<{ success: boolean; status: boolean; lastSeenAt: string | null }>(
      `/api/controllers/poll/${id}`,
      {}
    );
  }
}
