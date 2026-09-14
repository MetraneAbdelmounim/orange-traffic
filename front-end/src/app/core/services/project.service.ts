import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProjectKpi } from '../../models/controller';
import { Project } from '../../models/project';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects');
  }

  getKpi(id: string, days = 30): Observable<ProjectKpi> {
    return this.http.get<ProjectKpi>(`/api/projects/${id}/kpi`, { params: { days: String(days) } });
  }

  getById(id: string): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${id}`);
  }

  add(data: Partial<Project>): Observable<{ project: Project }> {
    return this.http.post<{ project: Project }>('/api/projects', data);
  }

  update(id: string, data: Partial<Project>): Observable<{ project: Project }> {
    return this.http.put<{ project: Project }>(`/api/projects/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/projects/${id}`);
  }
}
