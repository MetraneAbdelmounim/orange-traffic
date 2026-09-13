import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { BrandLogoComponent } from './brand-logo.component';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, BrandLogoComponent, ThemeToggleComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div class="h-[3px] bg-gradient-to-r from-brand via-brand-hover to-brand"></div>
      <div class="max-w-6xl mx-auto px-4 h-20 flex items-center gap-6">
        <a routerLink="/projects" class="shrink-0">
          <app-brand-logo size="lg" variant="partnership" />
        </a>

        <nav class="flex items-center gap-1 text-sm font-medium">
          <a routerLink="/projects" routerLinkActive="is-active" class="nav-link">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L22.28 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            Projets
          </a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin/members" routerLinkActive="is-active" class="nav-link">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Membres
            </a>
            <a routerLink="/admin/settings" routerLinkActive="is-active" class="nav-link">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Réglages
            </a>
          }
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <app-theme-toggle />
          <span class="avatar-chip" [title]="auth.isAdmin() ? 'Administrateur' : 'Membre'">
            {{ auth.isAdmin() ? 'AD' : 'ME' }}
          </span>
          <button type="button" class="btn btn-ghost" (click)="auth.logout()">Déconnexion</button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .nav-link {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.5rem;
        color: var(--ink-secondary);
        transition: background-color 140ms ease, color 140ms ease;
      }
      .nav-link:hover {
        color: var(--ink);
        background-color: var(--surface-hover);
      }
      .nav-link.is-active {
        color: var(--brand-ink);
        background-color: var(--brand-soft);
      }
      .avatar-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 9999px;
        background-color: var(--brand-soft);
        color: var(--brand-ink);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class HeaderComponent {
  auth = inject(AuthService);
}
