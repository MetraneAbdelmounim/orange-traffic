import { CommonModule } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';
import { ControllerSnapshot } from '../models/controller';

/**
 * The platform's signature status widget: a miniature traffic-signal head.
 *
 * Directly encodes the "decode when non-zero" rule from the brief — it never
 * renders `unitAlarmStatus1` as a bare integer, only the decoded flag names
 * (`snapshot.activeFlags`), with the raw ints available in the tooltip for
 * diagnostics. Colour is never the only signal: the lit lamp always pairs
 * with a text label.
 */
@Component({
  selector: 'app-signal-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="signal-badge" [title]="tooltip()">
      <span class="signal-lamps">
        <span class="signal-lamp is-red" [class.lit]="state() === 'crit'"></span>
        <span class="signal-lamp is-yellow"></span>
        <span class="signal-lamp is-green" [class.lit]="state() === 'good'"></span>
      </span>
      <span class="signal-label" [class]="'is-' + state()">
        {{ label() }}
      </span>
    </span>
  `,
})
export class SignalBadgeComponent {
  private readonly snapshotSig = signal<ControllerSnapshot | null>(null);
  private readonly reachableSig = signal<boolean>(false);

  @Input() set snapshot(value: ControllerSnapshot | null | undefined) {
    this.snapshotSig.set(value ?? null);
  }
  @Input() set reachable(value: boolean | undefined) {
    this.reachableSig.set(!!value);
  }

  readonly state = computed<'good' | 'crit' | 'neutral'>(() => {
    if (!this.reachableSig()) return 'neutral';
    const flags = this.snapshotSig()?.activeFlags ?? [];
    return flags.length > 0 ? 'crit' : 'good';
  });

  readonly label = computed(() => {
    if (!this.reachableSig()) return 'Injoignable';
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (flags.length === 0) return 'OK';
    if (flags.length === 1) return flags[0].split(' - ')[0];
    return `${flags.length} alarmes actives`;
  });

  readonly tooltip = computed(() => {
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (!this.reachableSig()) return this.snapshotSig()?.error ?? 'Aucune réponse SNMP';
    if (flags.length === 0) return 'Aucune alarme active';
    return flags.join('\n');
  });
}
