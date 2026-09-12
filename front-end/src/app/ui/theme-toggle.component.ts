import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ThemeService } from '../core/services/theme.service';

/** Cycles light → dark → system. Icon-only, so it reads as a control, not a label. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="theme.cycle()"
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-secondary transition hover:bg-hover hover:text-ink"
      [title]="'Thème : ' + label()"
      [attr.aria-label]="'Changer de thème (actuel : ' + label() + ')'"
    >
      @switch (theme.choice()) {
        @case ('light') {
          <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        }
        @case ('dark') {
          <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        }
        @default {
          <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <rect x="2.5" y="4" width="19" height="13" rx="2" />
            <path stroke-linecap="round" d="M8.5 20.5h7" />
          </svg>
        }
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

  label(): string {
    return { light: 'Clair', dark: 'Sombre', system: 'Système' }[this.theme.choice()];
  }
}
