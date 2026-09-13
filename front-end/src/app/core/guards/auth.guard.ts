import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SetupService } from '../services/setup.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  return router.createUrlTree(['/projects']);
};

/**
 * Applied to every normal route (login, projects, etc.) — redirects to
 * `/setup` if the backend says the app has no admin yet. The backend is
 * always re-asked (never cached) so this stays correct even if someone
 * finishes setup in another tab.
 */
export const setupGuard: CanActivateFn = async () => {
  const setup = inject(SetupService);
  const router = inject(Router);
  try {
    const { configured } = await setup.checkStatus();
    if (configured) return true;
    return router.createUrlTree(['/setup']);
  } catch {
    // The setup-status endpoint itself is unreachable (backend down) — let
    // the normal route load and surface its own error rather than trapping
    // the user on a broken redirect loop.
    return true;
  }
};

/** Applied to `/setup` itself — once configured, the wizard is gone for good. */
export const setupDoneGuard: CanActivateFn = async () => {
  const setup = inject(SetupService);
  const router = inject(Router);
  try {
    const { configured } = await setup.checkStatus();
    if (!configured) return true;
    return router.createUrlTree(['/login']);
  } catch {
    return true;
  }
};
