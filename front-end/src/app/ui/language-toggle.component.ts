import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-toggle" role="group" aria-label="Langue">
      <button type="button" [class.is-active]="i18n.lang() === 'fr'" (click)="i18n.use('fr')">FR</button>
      <button type="button" [class.is-active]="i18n.lang() === 'en'" (click)="i18n.use('en')">EN</button>
    </div>
  `,
  styles: [
    `
      .lang-toggle {
        display: inline-flex;
        border-radius: 0.5rem;
        border: 1px solid var(--line);
        overflow: hidden;
      }
      .lang-toggle button {
        padding: 0.4rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--ink-muted);
        background-color: var(--surface);
      }
      .lang-toggle button.is-active {
        color: var(--brand-ink);
        background-color: var(--brand-soft);
      }
      .lang-toggle button:hover:not(.is-active) {
        background-color: var(--surface-hover);
      }
    `,
  ],
})
export class LanguageToggleComponent {
  i18n = inject(I18nService);
}
