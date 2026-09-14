import { Routes } from '@angular/router';
import { adminGuard, authGuard, passwordChangeGuard, setupDoneGuard, setupGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupDoneGuard],
    loadComponent: () => import('./pages/setup/setup.component').then((m) => m.SetupComponent),
  },
  {
    path: 'login',
    canActivate: [setupGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [setupGuard, authGuard],
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'projects',
    canActivate: [setupGuard, authGuard, passwordChangeGuard],
    loadComponent: () => import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
  },
  {
    path: 'projects/:id',
    canActivate: [setupGuard, authGuard, passwordChangeGuard],
    loadComponent: () =>
      import('./pages/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
  },
  {
    path: 'controllers/:id',
    canActivate: [setupGuard, authGuard, passwordChangeGuard],
    loadComponent: () =>
      import('./pages/controller-detail/controller-detail.component').then((m) => m.ControllerDetailComponent),
  },
  {
    path: 'admin/members',
    canActivate: [setupGuard, adminGuard, passwordChangeGuard],
    loadComponent: () => import('./pages/admin/members.component').then((m) => m.MembersComponent),
  },
  {
    path: 'admin/settings',
    canActivate: [setupGuard, adminGuard, passwordChangeGuard],
    loadComponent: () => import('./pages/admin/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'admin/license',
    canActivate: [setupGuard, authGuard, passwordChangeGuard],
    loadComponent: () => import('./pages/admin/license.component').then((m) => m.LicenseComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
