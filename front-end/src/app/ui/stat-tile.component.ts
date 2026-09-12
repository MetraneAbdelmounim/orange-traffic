import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SafeHtmlPipe } from './safe-html.pipe';

/**
 * A single headline figure with an icon badge — the KPI-tile pattern used
 * throughout the controller dashboard instead of plain labelled text, so the
 * page reads as a monitoring product rather than a data dump.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  template: `
    <div class="card p-5 flex items-start gap-4">
      <span class="icon-badge" [class]="'tone-' + tone" [innerHTML]="icon | safeHtml"></span>
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted">{{ label }}</p>
        <p class="mt-1.5 text-xl font-bold tracking-tight tnum truncate" [class]="'value-' + tone">
          {{ value }}
        </p>
        @if (hint) {
          <p class="mt-0.5 text-xs text-ink-muted truncate">{{ hint }}</p>
        }
      </div>
    </div>
  `,
})
export class StatTileComponent {
  @Input() label = '';
  @Input() value: string | number = '—';
  @Input() hint = '';
  @Input() icon = '';
  @Input() tone: 'brand' | 'good' | 'crit' | 'neutral' = 'brand';
}
