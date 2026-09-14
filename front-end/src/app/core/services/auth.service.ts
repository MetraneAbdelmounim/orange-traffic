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
const MEMBER_ID_KEY = 'ot_member_id';
const MUST_CHANGE_PASSWORD_KEY = 'ot_must_change_password';

/**
 * Owns the JWT, its localStorage persistence, and the small amount of
 * identity state the UI needs synchronously (isAdmin, mustChangePassword)
 * without waiting on a round trip. Everything else about the current member
 * is re-read from `/api/auth/me` on demand — the token payload is never
 * trusted for anything but "is there a session at all".
 *
 * `mustChangePassword` here is a UX convenience only — the backend enforces
 * it independently on every protected route (`requirePasswordChanged`
 * middleware), so tampering with this local value cannot actually unlock
 * anything, only mis-route the UI until the first real API call 403s.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly isAdminSignal = signal<boolean>(localStorage.getItem(ADMIN_KEY) === 'true');
  private readonly memberIdSignal = signal<string | null>(localStorage.getItem(MEMBER_ID_KEY));
  private readonly mustChangePasswordSignal = signal<boolean>(
    localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true'
  );

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly isAdmin = computed(() => this.isAdminSignal());
  readonly memberId = computed(() => this.memberIdSignal());
  readonly mustChangePassword = computed(() => this.mustChangePasswordSignal());

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return this.tokenSignal();
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/signin', { username, password })
    );
    this.setSession(res.token, res.isAdmin, res.memberId, res.mustChangePassword);
  }

  /**
   * Persists a session from a token already obtained elsewhere — used by the
   * first-run setup wizard, whose admin-creation endpoint returns the same
   * `{token, isAdmin, memberId, mustChangePassword}` shape as
   * `/api/auth/signin` so the new admin lands signed in without a second
   * manual login.
   */
  setSession(token: string, isAdmin: boolean, memberId: string, mustChangePassword: boolean): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, String(isAdmin));
    localStorage.setItem(MEMBER_ID_KEY, memberId);
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(mustChangePassword));
    this.tokenSignal.set(token);
    this.isAdminSignal.set(isAdmin);
    this.memberIdSignal.set(memberId);
    this.mustChangePasswordSignal.set(mustChangePassword);
  }

  /** Called after a successful forced password change — the user is now unblocked. */
  clearMustChangePassword(): void {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, 'false');
    this.mustChangePasswordSignal.set(false);
  }

  /** Resyncs local state when the backend's own 403 (PASSWORD_CHANGE_REQUIRED) disagrees with it. */
  markMustChangePassword(): void {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, 'true');
    this.mustChangePasswordSignal.set(true);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.put('/api/auth/logout', {}));
    } catch {
      // Best-effort — the local session is cleared regardless.
    }
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  /** Called by the interceptor on a 401 — the token is no longer valid. */
  forceLogout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(MEMBER_ID_KEY);
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
    this.tokenSignal.set(null);
    this.isAdminSignal.set(false);
    this.memberIdSignal.set(null);
    this.mustChangePasswordSignal.set(false);
  }
}
