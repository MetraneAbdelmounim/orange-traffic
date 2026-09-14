import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Neither this app nor projet-youness had a connection-status indicator
 * before — the reference polls silently and only shows a "last updated"
 * chip. This adds the explicit LIVE/DISCONNECTED state the brief asks for,
 * on top of the same chip pattern already used elsewhere (`.chip`/`.chip-dot`).
 */
@Component({
  selector: 'app-live-indicator',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <span class="chip" [class.chip-good]="live" [class.chip-neutral]="!live">
      <span class="chip-dot"></span>{{ (live ? 'common.live' : 'common.disconnected') | t }}
    </span>
    @if (live && lastUpdate) {
      <span class="text-xs text-ink-muted tnum ml-2">{{ 'common.lastUpdate' | t: { time: formattedTime() } }}</span>
    }
  `,
})
export class LiveIndicatorComponent {
  @Input() live = false;
  @Input() lastUpdate: Date | null = null;

  formattedTime(): string {
    return this.lastUpdate ? this.lastUpdate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  }
}
