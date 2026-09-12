import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
  },
  {
    path: 'projects/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
  },
  {
    path: 'controllers/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/controller-detail/controller-detail.component').then((m) => m.ControllerDetailComponent),
  },
  {
    path: 'admin/members',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/members.component').then((m) => m.MembersComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
