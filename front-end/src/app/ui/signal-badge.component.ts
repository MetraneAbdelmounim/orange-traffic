import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { translateAlarmLabel } from '../core/alarm-bits';
import { I18nService } from '../i18n/i18n.service';
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
  private i18n = inject(I18nService);
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
    const lang = this.i18n.lang();
    if (!this.reachableSig()) return this.i18n.t('status.unreachable');
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (flags.length === 0) return this.i18n.t('status.ok');
    if (flags.length === 1) return translateAlarmLabel(flags[0], lang).split(' - ')[0];
    return this.i18n.t('status.activeAlarmsCount', { count: flags.length });
  });

  readonly tooltip = computed(() => {
    const lang = this.i18n.lang();
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (!this.reachableSig()) return this.snapshotSig()?.error ?? this.i18n.t('status.noSnmpResponse');
    if (flags.length === 0) return this.i18n.t('status.noActiveAlarm');
    return flags.map((f) => translateAlarmLabel(f, lang)).join('\n');
  });
}
