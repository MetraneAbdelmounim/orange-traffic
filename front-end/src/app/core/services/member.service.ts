import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Member } from '../../models/member';

@Injectable({ providedIn: 'root' })
export class MemberService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Member[]> {
    return this.http.get<Member[]>('/api/members');
  }

  add(data: { username: string; isAdmin: boolean; projects: string[] }) {
    return this.http.post<{ member: Member; temporaryPassword: string }>('/api/members', data);
  }

  update(id: string, data: Partial<Pick<Member, 'isAdmin'>> & { projects?: string[] }) {
    return this.http.put<{ member: Member }>(`/api/members/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/members/${id}`);
  }
}
