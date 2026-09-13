import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface SetupStatus {
  configured: boolean;
}

interface AdminCreatedResponse {
  token: string;
  memberId: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
  expiresIn: number;
}

/**
 * Talks to /api/setup. The backend is the sole source of truth for whether
 * the app is configured (at least one admin exists) — this service never
 * caches that answer across calls, so a stale frontend guess can't let a
 * second person reach the setup wizard after someone else just finished it.
 */
@Injectable({ providedIn: 'root' })
export class SetupService {
  constructor(private http: HttpClient) {}

  checkStatus(): Promise<SetupStatus> {
    return firstValueFrom(this.http.get<SetupStatus>('/api/setup/status'));
  }

  createAdmin(username: string, password: string, confirmPassword: string): Promise<AdminCreatedResponse> {
    return firstValueFrom(
      this.http.post<AdminCreatedResponse>('/api/setup/admin', { username, password, confirmPassword })
    );
  }
}
