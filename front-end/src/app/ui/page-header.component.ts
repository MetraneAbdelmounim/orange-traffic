import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SafeHtmlPipe } from './safe-html.pipe';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div class="flex items-start gap-4">
        @if (icon) {
          <span class="icon-badge" [innerHTML]="icon | safeHtml"></span>
        }
        <div>
          @if (backLink) {
            <a [routerLink]="backLink" class="text-sm text-ink-muted hover:text-ink">← {{ backLabel }}</a>
          }
          <h1 class="text-2xl font-bold tracking-tight text-ink" [class.mt-1]="!!backLink">{{ title }}</h1>
          @if (subtitle) {
            <p class="text-sm text-ink-muted mt-1">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="flex items-center gap-2">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() backLink?: string[];
  @Input() backLabel = 'Retour';
}
