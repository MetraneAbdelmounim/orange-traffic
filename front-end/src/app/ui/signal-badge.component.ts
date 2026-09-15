import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { translateAlarmLabel } from '../core/alarm-bits';
import { I18nService } from '../i18n/i18n.service';
import { AlarmDetail, ControllerSnapshot } from '../models/controller';

export type CommunicationState = 'reachable' | 'degraded' | 'unreachable';

/**
 * The platform's signature status widget: a miniature traffic-signal head.
 *
 * Directly encodes the "decode when non-zero" rule from the brief — it never
 * renders `unitAlarmStatus1` as a bare integer, only the decoded flag names
 * (`snapshot.activeFlags`), with the raw ints available in the tooltip for
 * diagnostics. Colour is never the only signal: the lit lamp always pairs
 * with a text label.
 *
 * Two orthogonal signals share the same 3-lamp metaphor: connectivity
 * (reachable/degraded/unreachable) and, while reachable, alarm severity
 * (none/warning-only/critical) — red covers both "critical alarm" and
 * "confirmed unreachable", amber covers both "warning-only alarm" and
 * "degraded/intermittent communication". The lamp gives the coarse severity
 * at a glance; the text label underneath always says which of the two it is.
 */
@Component({
  selector: 'app-signal-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="signal-badge" [title]="tooltip()">
      <span class="signal-lamps">
        <span class="signal-lamp is-red" [class.lit]="state() === 'crit' || state() === 'unreachable'"></span>
        <span class="signal-lamp is-yellow" [class.lit]="state() === 'warn' || state() === 'degraded' || state() === 'maintenance'"></span>
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
  private readonly communicationStateSig = signal<CommunicationState | null>(null);
  private readonly maintenanceSig = signal<boolean>(false);

  @Input() set snapshot(value: ControllerSnapshot | null | undefined) {
    this.snapshotSig.set(value ?? null);
  }
  /** @deprecated pass `communicationState` instead — kept as a fallback for any caller not yet updated. */
  @Input() set reachable(value: boolean | undefined) {
    this.reachableSig.set(!!value);
  }
  @Input() set communicationState(value: CommunicationState | undefined) {
    this.communicationStateSig.set(value ?? null);
  }
  /** While true, overrides everything below with a distinct maintenance state — regardless of the real alarm/connectivity data underneath. */
  @Input() set maintenance(value: boolean | undefined) {
    this.maintenanceSig.set(!!value);
  }

  private resolvedCommState(): CommunicationState {
    return this.communicationStateSig() ?? (this.reachableSig() ? 'reachable' : 'unreachable');
  }

  private alarms(): AlarmDetail[] {
    return this.snapshotSig()?.alarms ?? [];
  }

  readonly state = computed<'good' | 'warn' | 'crit' | 'degraded' | 'unreachable' | 'maintenance'>(() => {
    if (this.maintenanceSig()) return 'maintenance';
    const comm = this.resolvedCommState();
    if (comm === 'unreachable') return 'unreachable';
    if (comm === 'degraded') return 'degraded';
    const alarms = this.alarms();
    if (alarms.some((a) => a.criticality === 'critical')) return 'crit';
    if (alarms.length > 0) return 'warn';
    return 'good';
  });

  readonly label = computed(() => {
    const lang = this.i18n.lang();
    if (this.maintenanceSig()) return this.i18n.t('status.maintenance');
    const comm = this.resolvedCommState();
    if (comm === 'unreachable') return this.i18n.t('status.unreachable');
    if (comm === 'degraded') return this.i18n.t('status.degraded');
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (flags.length === 0) return this.i18n.t('status.ok');
    if (flags.length === 1) return translateAlarmLabel(flags[0], lang).split(' - ')[0];
    return this.i18n.t('status.activeAlarmsCount', { count: flags.length });
  });

  readonly tooltip = computed(() => {
    const lang = this.i18n.lang();
    const flags = this.snapshotSig()?.activeFlags ?? [];
    if (this.maintenanceSig()) return this.i18n.t('status.maintenanceTooltip');
    const comm = this.resolvedCommState();
    if (comm === 'unreachable') return this.snapshotSig()?.error ?? this.i18n.t('status.noSnmpResponse');
    if (comm === 'degraded') return this.i18n.t('status.degradedTooltip', { detail: this.snapshotSig()?.error ?? '' });
    if (flags.length === 0) return this.i18n.t('status.noActiveAlarm');
    return flags.map((f) => translateAlarmLabel(f, lang)).join('\n');
  });
}
