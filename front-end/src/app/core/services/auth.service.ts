import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface LoginResponse {
  token: string;
  memberId: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
  expiresIn: number;
}

const TOKEN_KEY = 'ot_token';
const ADMIN_KEY = 'ot_is_admin';

/**
 * Owns the JWT, its localStorage persistence, and the small amount of
 * identity state the UI needs synchronously (isAdmin) without waiting on a
 * round trip. Everything else about the current member is re-read from
 * `/api/auth/me` on demand — the token payload is never trusted for anything
 * but "is there a session at all".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly isAdminSignal = signal<boolean>(localStorage.getItem(ADMIN_KEY) === 'true');

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly isAdmin = computed(() => this.isAdminSignal());

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return this.tokenSignal();
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/signin', { username, password })
    );
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(ADMIN_KEY, String(res.isAdmin));
    this.tokenSignal.set(res.token);
    this.isAdminSignal.set(res.isAdmin);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.put('/api/auth/logout', {}));
    } catch {
      // Best-effort — the local session is cleared regardless.
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this.tokenSignal.set(null);
    this.isAdminSignal.set(false);
    this.router.navigateByUrl('/login');
  }

  /** Called by the interceptor on a 401 — the token is no longer valid. */
  forceLogout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this.tokenSignal.set(null);
    this.isAdminSignal.set(false);
    this.router.navigateByUrl('/login');
  }
}
