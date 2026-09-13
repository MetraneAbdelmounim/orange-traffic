import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.url.includes('/api/auth/signin')) {
        auth.forceLogout();
      }
      // Missing/expired license — the backend has already locked the
      // endpoint down; send the user to the page that can actually fix it
      // rather than leaving them on a page full of failed requests.
      if (err.status === 402 && !router.url.startsWith('/admin/license')) {
        router.navigateByUrl('/admin/license');
      }
      return throwError(() => err);
    })
  );
};
