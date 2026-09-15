import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { Subscription, catchError, exhaustMap, of } from 'rxjs';
import { AlarmEventService } from '../../core/services/alarm-event.service';
import { criticalityForLabel, translateAlarmLabel } from '../../core/alarm-bits';
import { refreshWhileVisible } from '../../core/auto-refresh';
import { AuthService } from '../../core/services/auth.service';
import { ControllerService } from '../../core/services/controller.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService, Language } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { fr, TranslationKey } from '../../i18n/fr';
import { AlarmEvent } from '../../models/alarm-event';
import { Controller, ControllerHistory } from '../../models/controller';
import { Project } from '../../models/project';
import { ChartImage, downloadSingleControllerReport } from './controller-report-single';
import { LiveIndicatorComponent } from '../../ui/live-indicator.component';
import { ModalComponent } from '../../ui/modal.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';
import { SignalBadgeComponent } from '../../ui/signal-badge.component';
import { StatTileComponent } from '../../ui/stat-tile.component';

Chart.register(...registerables);

type ReadingRow = ControllerHistory['readings'][number];

const HISTORY_RANGES: { key: TranslationKey; hours: number }[] = [
  { key: 'history.24h', hours: 24 },
  { key: 'history.1w', hours: 24 * 7 },
  { key: 'history.2w', hours: 24 * 14 },
  { key: 'history.3w', hours: 24 * 21 },
  { key: 'history.4w', hours: 24 * 28 },
];

interface TimelineSegment {
  start: number;
  end: number;
}

interface TimelineRow {
  flag: string;
  label: string;
  criticality: 'critical' | 'warning';
  segments: TimelineSegment[];
}

/**
 * Reconstructs, per flag, the intervals during which it was active within
 * [windowStart, windowEnd] — from the appeared/cleared journal alone, walked
 * backward from the controller's *currently known* active flags (the one
 * fact we're always sure of) rather than assuming what the state was at the
 * start of the window. A flag still active at windowEnd, or already active
 * at windowStart with no transition inside the window, both fall out of this
 * walk correctly with no special-casing.
 */
function buildTimelineRows(
  events: AlarmEvent[],
  currentFlags: string[],
  windowStart: number,
  windowEnd: number
): TimelineRow[] {
  const byFlag = new Map<string, AlarmEvent[]>();
  for (const e of events) {
    if (!byFlag.has(e.flag)) byFlag.set(e.flag, []);
    byFlag.get(e.flag)!.push(e);
  }
  for (const flag of currentFlags) {
    if (!byFlag.has(flag)) byFlag.set(flag, []);
  }

  const rows: TimelineRow[] = [];
  for (const [flag, flagEvents] of byFlag) {
    // Events arrive newest-first from the API — exactly the order this walk needs.
    const sorted = [...flagEvents].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const segments: TimelineSegment[] = [];
    let active = currentFlags.includes(flag);
    let cursor = windowEnd;

    for (const event of sorted) {
      const t = new Date(event.occurredAt).getTime();
      if (event.state === 'active') {
        if (active) segments.push({ start: t, end: cursor });
        active = false;
      } else {
        active = true;
      }
      cursor = t;
    }
    if (active) segments.push({ start: windowStart, end: cursor });

    if (segments.length > 0) {
      rows.push({ flag, label: '', criticality: criticalityForLabel(flag), segments });
    }
  }

  // Critical flags first, then most recently active — the alarms worth
  // seeing first surface at the top of the timeline instead of alphabetical.
  rows.sort((a, b) => {
    if (a.criticality !== b.criticality) return a.criticality === 'critical' ? -1 : 1;
    const aLast = Math.max(...a.segments.map((s) => s.end));
    const bLast = Math.max(...b.segments.map((s) => s.end));
    return bLast - aLast;
  });
  return rows;
}

const ICON = {
  controller: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`,
  clock: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>`,
  pulse: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h3l2.25-7.5 4.5 15L15.75 12h4.5" /></svg>`,
  info: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`,
  bell: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>`,
  layers: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" /></svg>`,
  chart: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>`,
  history: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
};

/** Formats SNMP sysUpTime centiseconds (TimeTicks) as "3d 4h12m" / "3j 4h12m". */
function formatUptime(ticks: number | null, lang: Language): string {
  if (ticks === null || ticks === undefined) return '—';
  const totalSeconds = Math.floor(ticks / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const dayUnit = lang === 'fr' ? 'j' : 'd';
  const parts: string[] = [];
  if (days) parts.push(`${days}${dayUnit}`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

@Component({
  selector: 'app-controller-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SignalBadgeComponent, StatTileComponent, SafeHtmlPipe, LiveIndicatorComponent, ModalComponent, TranslatePipe],
  template: `
    @if (controller(); as c) {
      <div class="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div class="flex items-center justify-between">
          <a [routerLink]="['/projects', projectId(c)]" class="text-sm text-ink-muted hover:text-ink">← {{ 'nav.projects' | t }}</a>
          <app-live-indicator [live]="liveConnected()" [lastUpdate]="lastUpdate()" />
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="icon-badge" [innerHTML]="icon.controller | safeHtml"></span>
            <div>
              <h1 class="text-2xl font-bold tracking-tight text-ink">{{ c.nom }}</h1>
              <p class="text-sm text-ink-muted font-mono mt-1">{{ c.ip }}:{{ c.port }} · {{ c.model }}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <app-signal-badge [snapshot]="c.lastSnapshot" [communicationState]="c.communicationState" [maintenance]="c.maintenanceMode" />
            <button type="button" class="btn btn-ghost" [disabled]="reportBusy()" (click)="downloadReport(c)">
              <span [innerHTML]="icon.chart | safeHtml"></span>
              {{ (reportBusy() ? 'common.loading' : 'controllerDetail.downloadReport') | t }}
            </button>
            <button type="button" class="btn btn-primary" [disabled]="polling()" (click)="pollNow()">
              {{ (polling() ? 'controllerDetail.polling' : 'controllerDetail.pollNow') | t }}
            </button>
          </div>
        </div>

        @if (pollError()) {
          <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ pollError() }}</p>
        }

        @if (hasActiveIssue(c) || c.acknowledged || c.maintenanceMode || auth.isAdmin()) {
          <div class="card p-4 flex flex-wrap items-center gap-3">
            @if (c.acknowledged) {
              <span class="chip chip-neutral">
                <span class="chip-dot"></span>
                {{ 'controllerDetail.acknowledgedBy' | t: { by: c.acknowledgment.by || '—', at: formatDate(c.acknowledgment.at) } }}
              </span>
              <button type="button" class="btn btn-ghost" [disabled]="ackBusy()" (click)="cancelAcknowledgment()">
                {{ 'controllerDetail.unacknowledge' | t }}
              </button>
            } @else if (hasActiveIssue(c)) {
              <button type="button" class="btn btn-ghost" [disabled]="ackBusy()" (click)="ackNote = ''; showAckModal.set(true)">
                {{ 'controllerDetail.acknowledge' | t }}
              </button>
            }

            @if (c.maintenanceMode) {
              <span class="chip chip-warn">
                <span class="chip-dot"></span>
                {{ 'controllerDetail.maintenanceActive' | t: { at: formatDate(c.maintenance.at) } }}
                @if (c.maintenance.note) {
                  — {{ c.maintenance.note }}
                }
              </span>
              @if (auth.isAdmin()) {
                <button type="button" class="btn btn-ghost" [disabled]="maintenanceBusy()" (click)="disableMaintenance()">
                  {{ 'controllerDetail.disableMaintenance' | t }}
                </button>
              }
            } @else if (auth.isAdmin()) {
              <button type="button" class="btn btn-ghost" [disabled]="maintenanceBusy()" (click)="maintenanceNote = ''; showMaintenanceModal.set(true)">
                {{ 'controllerDetail.enableMaintenance' | t }}
              </button>
            }

            @if (actionError()) {
              <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ actionError() }}</p>
            }
          </div>
        }

        <div class="grid gap-4 sm:grid-cols-3">
          <app-stat-tile
            [label]="'controllerDetail.lastReading' | t"
            [value]="(c.lastSnapshot.measuredAt | date: 'medium') || '—'"
            [icon]="icon.clock"
            tone="brand"
          />
          <app-stat-tile [label]="'controllerDetail.snmpUptime' | t" [value]="uptime()" [hint]="'controllerDetail.sinceLastRestart' | t" [icon]="icon.pulse" tone="good" />
          <app-stat-tile
            label="sysDescr"
            [value]="c.lastSnapshot.sysDescr || '—'"
            [icon]="icon.info"
            tone="neutral"
          />
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="icon-badge tone-crit" [innerHTML]="icon.bell | safeHtml"></span>
            <h2 class="font-semibold text-ink">{{ 'controllerDetail.ntcipAlarms' | t }}</h2>
          </div>
          @if (c.communicationState !== 'reachable' && c.lastSnapshot.alarms.length > 0) {
            <p class="chip chip-warn mb-3 self-start">
              <span class="chip-dot"></span>
              {{ (c.communicationState === 'unreachable' ? 'controllerDetail.staleAlarmDataUnreachable' : 'controllerDetail.staleAlarmDataDegraded') | t: { at: formatDate(c.lastSnapshot.measuredAt) } }}
            </p>
          }
          @if (!c.lastSnapshot.alarms.length) {
            <p class="chip chip-good"><span class="chip-dot"></span>{{ 'controllerDetail.noActiveAlarm' | t }}</p>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (alarm of c.lastSnapshot.alarms; track alarm.label) {
                <li class="chip" [class.chip-crit]="alarm.criticality === 'critical'" [class.chip-warn]="alarm.criticality === 'warning'">
                  <span class="chip-dot"></span>{{ translatedAlarmLabel(alarm.label) }}
                  <span class="opacity-70 font-mono text-[0.65rem]">{{ alarm.sourceObject }}</span>
                </li>
              }
            </ul>
          }
          <div class="grid gap-3 sm:grid-cols-3 mt-4 text-xs text-ink-muted tnum">
            <div>unitAlarmStatus1 = {{ c.lastSnapshot.unitAlarmStatus1 ?? '—' }}</div>
            <div>unitAlarmStatus2 = {{ c.lastSnapshot.unitAlarmStatus2 ?? '—' }}</div>
            <div>shortAlarmStatus = {{ c.lastSnapshot.shortAlarmStatus ?? '—' }}</div>
          </div>
        </div>

        @if (c.lastSnapshot.phaseStatus || c.lastSnapshot.detectorStatus) {
          <div class="card p-5">
            <div class="flex items-center gap-3 mb-4">
              <span class="icon-badge" [innerHTML]="icon.layers | safeHtml"></span>
              <h2 class="font-semibold text-ink">{{ 'controllerDetail.detailedStatus' | t }}</h2>
              <span class="chip chip-neutral">{{ 'controllerDetail.unconfirmedModel' | t }}</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 text-sm">
              @if (c.lastSnapshot.phaseStatus) {
                <div>
                  <p class="text-xs text-ink-muted mb-1">{{ 'controllerDetail.phases' | t }}</p>
                  @for (kv of objectEntries(c.lastSnapshot.phaseStatus); track kv[0]) {
                    <p class="tnum">{{ kv[0] }} = {{ kv[1] }}</p>
                  }
                </div>
              }
              @if (c.lastSnapshot.detectorStatus) {
                <div>
                  <p class="text-xs text-ink-muted mb-1">{{ 'controllerDetail.detectors' | t }}</p>
                  @for (kv of objectEntries(c.lastSnapshot.detectorStatus); track kv[0]) {
                    <p class="tnum">{{ kv[0] }} = {{ kv[1] }}</p>
                  }
                </div>
              }
            </div>
          </div>
        }

        <div class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-3">
              <span class="icon-badge" [innerHTML]="icon.chart | safeHtml"></span>
              <h2 class="font-semibold text-ink">{{ 'controllerDetail.history' | t }}</h2>
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (range of ranges; track range.hours) {
                <button
                  type="button"
                  class="btn"
                  [class.btn-primary]="historyHours() === range.hours"
                  [class.btn-ghost]="historyHours() !== range.hours"
                  (click)="setHistoryRange(range.hours)"
                >
                  {{ range.key | t }}
                </button>
              }
            </div>
          </div>
          <div class="mb-8">
            <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{{ 'controllerDetail.timelineTitle' | t }}</p>
            <p class="text-sm text-ink-muted py-6 text-center" [hidden]="timelineRows().length > 0">{{ 'controllerDetail.timelineEmpty' | t }}</p>
            <div [style.height.px]="timelineHeight()" [hidden]="timelineRows().length === 0">
              <canvas #timelineCanvas></canvas>
            </div>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{{ 'controllerDetail.chartActiveFlags' | t }}</p>
            <canvas #activeFlagsCanvas height="140"></canvas>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="icon-badge" [innerHTML]="icon.history | safeHtml"></span>
            <h2 class="font-semibold text-ink">{{ 'controllerDetail.alarmJournal' | t }}</h2>
          </div>
          @if (events().length === 0) {
            <p class="text-sm text-ink-muted">{{ 'controllerDetail.noTransitions' | t }}</p>
          } @else {
            <ul class="flex flex-col">
              @for (event of pagedEvents(); track event._id) {
                <li class="table-row py-2 flex items-center justify-between gap-3 text-sm">
                  <span class="flex items-center gap-2">
                    <span class="chip" [class.chip-crit]="event.state === 'active'" [class.chip-good]="event.state === 'cleared'">
                      <span class="chip-dot"></span>{{ (event.state === 'active' ? 'controllerDetail.appeared' : 'controllerDetail.cleared') | t }}
                    </span>
                    {{ translatedAlarmLabel(event.flag) }}
                  </span>
                  <span class="text-ink-muted tnum">{{ event.occurredAt | date: 'medium' }}</span>
                </li>
              }
            </ul>
            @if (totalPages() > 1) {
              <div class="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-line">
                <button type="button" class="btn btn-ghost" [disabled]="page() === 1" (click)="page.set(page() - 1)">
                  ← {{ 'common.previous' | t }}
                </button>
                <span class="text-xs text-ink-muted">{{ 'common.page' | t }} {{ page() }} / {{ totalPages() }}</span>
                <button type="button" class="btn btn-ghost" [disabled]="page() === totalPages()" (click)="page.set(page() + 1)">
                  {{ 'common.next' | t }} →
                </button>
              </div>
            }
          }
        </div>
      </div>

      <app-modal [open]="showAckModal()" [title]="'controllerDetail.acknowledge' | t" size="sm" (closed)="showAckModal.set(false)">
        <div>
          <label class="label" for="ackNote">{{ 'controllerDetail.noteOptional' | t }}</label>
          <textarea id="ackNote" name="ackNote" class="field" rows="3" [(ngModel)]="ackNote"></textarea>
        </div>
        <ng-container modalFooter>
          <button type="button" class="btn btn-ghost" (click)="showAckModal.set(false)">{{ 'common.cancel' | t }}</button>
          <button type="button" class="btn btn-primary" [disabled]="ackBusy()" (click)="confirmAcknowledge()">
            {{ (ackBusy() ? 'common.loading' : 'common.confirm') | t }}
          </button>
        </ng-container>
      </app-modal>

      <app-modal [open]="showMaintenanceModal()" [title]="'controllerDetail.enableMaintenance' | t" size="sm" (closed)="showMaintenanceModal.set(false)">
        <div>
          <label class="label" for="maintenanceNote">{{ 'controllerDetail.noteOptional' | t }}</label>
          <textarea id="maintenanceNote" name="maintenanceNote" class="field" rows="3" [(ngModel)]="maintenanceNote"></textarea>
        </div>
        <ng-container modalFooter>
          <button type="button" class="btn btn-ghost" (click)="showMaintenanceModal.set(false)">{{ 'common.cancel' | t }}</button>
          <button type="button" class="btn btn-primary" [disabled]="maintenanceBusy()" (click)="confirmEnableMaintenance()">
            {{ (maintenanceBusy() ? 'common.loading' : 'common.confirm') | t }}
          </button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class ControllerDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private controllerService = inject(ControllerService);
  private alarmEventService = inject(AlarmEventService);
  private i18n = inject(I18nService);
  auth = inject(AuthService);

  icon = ICON;
  ranges = HISTORY_RANGES;

  @ViewChild('activeFlagsCanvas') activeFlagsCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('timelineCanvas') timelineCanvasRef?: ElementRef<HTMLCanvasElement>;
  private activeFlagsChart?: Chart;
  private timelineChart?: Chart;

  private readonly PAGE_SIZE = 10;
  private readonly TIMELINE_ROW_HEIGHT = 34;

  controller = signal<Controller | null>(null);
  events = signal<AlarmEvent[]>([]);
  timelineRows = signal<TimelineRow[]>([]);
  timelineHeight = computed(() => Math.max(80, this.timelineRows().length * this.TIMELINE_ROW_HEIGHT + 40));
  polling = signal(false);
  pollError = signal<string | null>(null);
  page = signal(1);
  historyHours = signal(24);
  liveConnected = signal(true);
  lastUpdate = signal<Date | null>(null);
  private liveSub?: Subscription;
  pagedEvents = computed(() => {
    const start = (this.page() - 1) * this.PAGE_SIZE;
    return this.events().slice(start, start + this.PAGE_SIZE);
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.events().length / this.PAGE_SIZE)));

  private controllerId!: string;
  private history?: ControllerHistory;
  private timelineWindow = { start: 0, end: 0 };
  private viewReady = false;

  ngOnInit(): void {
    this.controllerId = this.route.snapshot.paramMap.get('id')!;
    this.load();
    this.lastUpdate.set(new Date());

    // Lightweight live refresh: re-fetch the controller (status + current
    // alarms) and the alarm log every tick, but not the history/charts —
    // re-rendering four canvases every 15s would just flicker for no real
    // benefit between poll sweeps. exhaustMap drops a tick if the previous
    // one hasn't resolved yet, so a slow/stalled request can't pile up.
    this.liveSub = refreshWhileVisible()
      .pipe(
        exhaustMap(() =>
          this.controllerService.getById(this.controllerId).pipe(catchError(() => of(null)))
        )
      )
      .subscribe((c) => {
        if (c) {
          this.controller.set(c);
          this.liveConnected.set(true);
          this.lastUpdate.set(new Date());
          this.alarmEventService.getByController(this.controllerId).subscribe((events) => this.events.set(events));
        } else {
          this.liveConnected.set(false);
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.history) this.renderActiveFlagsChart(this.history);
    this.renderTimeline();
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  load(): void {
    this.controllerService.getById(this.controllerId).subscribe((c) => this.controller.set(c));
    this.alarmEventService.getByController(this.controllerId).subscribe((events) => {
      this.events.set(events);
      this.page.set(1);
    });
    this.loadHistory();
    this.loadTimeline();
  }

  loadHistory(): void {
    this.controllerService.getHistory(this.controllerId, this.historyHours()).subscribe((history) => {
      this.history = history;
      if (this.viewReady) this.renderActiveFlagsChart(history);
    });
  }

  /** Fetches every alarm transition within the selected period and rebuilds the timeline rows from it. */
  loadTimeline(): void {
    const hours = this.historyHours();
    this.alarmEventService.getByController(this.controllerId, { hours, limit: 1000 }).subscribe((events) => {
      const currentFlags = this.controller()?.lastSnapshot.activeFlags ?? [];
      const windowEnd = Date.now();
      const windowStart = windowEnd - hours * 3600 * 1000;
      const rows = buildTimelineRows(events, currentFlags, windowStart, windowEnd);
      this.timelineWindow = { start: windowStart, end: windowEnd };
      this.timelineRows.set(rows);
      // The canvas element is always in the DOM (toggled via [hidden], not
      // @if) so the ViewChild ref is already valid here regardless of
      // whether this is the first load or a period change.
      if (this.viewReady) this.renderTimeline();
    });
  }

  setHistoryRange(hours: number): void {
    if (this.historyHours() === hours) return;
    this.historyHours.set(hours);
    this.loadHistory();
    this.loadTimeline();
  }

  reportBusy = signal(false);

  showAckModal = signal(false);
  ackBusy = signal(false);
  ackNote = '';
  showMaintenanceModal = signal(false);
  maintenanceBusy = signal(false);
  maintenanceNote = '';
  actionError = signal<string | null>(null);

  translatedAlarmLabel(label: string): string {
    return translateAlarmLabel(label, this.i18n.lang());
  }

  hasActiveIssue(c: Controller): boolean {
    return c.lastSnapshot.alarms.length > 0 || !c.status;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const locale = this.i18n.lang() === 'fr' ? 'fr-CA' : 'en-US';
    return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  confirmAcknowledge(): void {
    this.ackBusy.set(true);
    this.actionError.set(null);
    this.controllerService.setAcknowledgment(this.controllerId, true, this.ackNote).subscribe({
      next: (c) => {
        this.controller.set(c);
        this.ackBusy.set(false);
        this.showAckModal.set(false);
      },
      error: (err) => {
        this.ackBusy.set(false);
        this.actionError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllerDetail.actionFailed'));
      },
    });
  }

  cancelAcknowledgment(): void {
    this.ackBusy.set(true);
    this.actionError.set(null);
    this.controllerService.setAcknowledgment(this.controllerId, false).subscribe({
      next: (c) => {
        this.controller.set(c);
        this.ackBusy.set(false);
      },
      error: (err) => {
        this.ackBusy.set(false);
        this.actionError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllerDetail.actionFailed'));
      },
    });
  }

  confirmEnableMaintenance(): void {
    this.maintenanceBusy.set(true);
    this.actionError.set(null);
    this.controllerService.setMaintenance(this.controllerId, true, this.maintenanceNote).subscribe({
      next: (c) => {
        this.controller.set(c);
        this.maintenanceBusy.set(false);
        this.showMaintenanceModal.set(false);
      },
      error: (err) => {
        this.maintenanceBusy.set(false);
        this.actionError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllerDetail.actionFailed'));
      },
    });
  }

  disableMaintenance(): void {
    this.maintenanceBusy.set(true);
    this.actionError.set(null);
    this.controllerService.setMaintenance(this.controllerId, false).subscribe({
      next: (c) => {
        this.controller.set(c);
        this.maintenanceBusy.set(false);
      },
      error: (err) => {
        this.maintenanceBusy.set(false);
        this.actionError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllerDetail.actionFailed'));
      },
    });
  }

  /**
   * Captures the already-rendered chart canvases as PNGs (`toDataURL`)
   * rather than re-rendering them inside the PDF generator — this
   * automatically respects whatever period is currently selected on screen,
   * with no separate charting logic to keep in sync.
   */
  async downloadReport(controller: Controller): Promise<void> {
    this.reportBusy.set(true);
    try {
      // The report document itself is always produced in French (its static
      // labels are hardcoded French), so every dynamic value fed into it is
      // resolved against the French dictionary directly — regardless of the
      // UI's current language — to avoid a mixed-language PDF.
      const charts: ChartImage[] = [];
      const timelineCanvas = this.timelineCanvasRef?.nativeElement;
      if (timelineCanvas && this.timelineRows().length > 0) {
        charts.push({
          title: fr['controllerDetail.timelineTitle'],
          dataUrl: timelineCanvas.toDataURL('image/png'),
          width: timelineCanvas.width,
          height: timelineCanvas.height,
        });
      }
      const activeFlagsCanvas = this.activeFlagsCanvasRef?.nativeElement;
      if (activeFlagsCanvas) {
        charts.push({
          title: fr['controllerDetail.chartActiveFlags'],
          dataUrl: activeFlagsCanvas.toDataURL('image/png'),
          width: activeFlagsCanvas.width,
          height: activeFlagsCanvas.height,
        });
      }

      const project = controller.project && typeof controller.project === 'object' ? (controller.project as Project) : null;
      const periodLabel = this.ranges.find((r) => r.hours === this.historyHours())?.key;
      const periodText = periodLabel ? fr[periodLabel] : fr['history.24h'];

      await downloadSingleControllerReport(controller, project, charts, periodText);
    } finally {
      this.reportBusy.set(false);
    }
  }

  pollNow(): void {
    this.polling.set(true);
    this.pollError.set(null);
    this.controllerService.pollNow(this.controllerId).subscribe({
      next: (result) => {
        this.load();
        this.polling.set(false);
        // The request itself succeeding only means the poll ran, not that the
        // device answered — `success` reflects whether it actually did.
        // Without this check, a controller that's genuinely unreachable from
        // this server looked identical to a working refresh: no error, just
        // the same stale reading, which is exactly what was reported.
        if (!result.success) {
          this.pollError.set(this.i18n.t('controllerDetail.pollUnreachable'));
        }
      },
      error: (err) => {
        this.polling.set(false);
        this.pollError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllerDetail.pollFailed'));
      },
    });
  }

  uptime(): string {
    return formatUptime(this.controller()?.lastSnapshot.sysUpTimeTicks ?? null, this.i18n.lang());
  }

  projectId(c: Controller): string {
    return typeof c.project === 'string' ? c.project : c.project?._id || '';
  }

  objectEntries(obj: Record<string, unknown>): [string, unknown][] {
    return Object.entries(obj);
  }

  private chartTheme() {
    const rootStyles = getComputedStyle(document.documentElement);
    return {
      lineColor: rootStyles.getPropertyValue('--chart-line').trim() || '#ff5a1f',
      gridColor: rootStyles.getPropertyValue('--chart-grid').trim() || '#ece5df',
      inkMuted: rootStyles.getPropertyValue('--ink-muted').trim() || '#756b6d',
      crit: rootStyles.getPropertyValue('--crit').trim() || '#c4362f',
      warn: rootStyles.getPropertyValue('--warn').trim() || '#8a6100',
    };
  }

  /** Simple count-of-active-alarms-over-time summary, from the Reading time series (unrelated to the AlarmEvent-driven timeline below). */
  private renderActiveFlagsChart(history: ControllerHistory): void {
    const canvas = this.activeFlagsCanvasRef?.nativeElement;
    if (!canvas) return;

    const { lineColor, gridColor, inkMuted } = this.chartTheme();
    const locale = this.i18n.lang() === 'fr' ? 'fr-CA' : 'en-US';
    const multiDay = this.historyHours() > 24;
    const labels = history.readings.map((r) =>
      new Date(r.ts).toLocaleString(locale, multiDay
        ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' }
      )
    );

    this.activeFlagsChart?.destroy();
    this.activeFlagsChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.i18n.t('controllerDetail.chartActiveFlags'),
            data: history.readings.map((r) => r.activeFlags.length),
            borderColor: lineColor,
            backgroundColor: lineColor,
            stepped: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: inkMuted, maxTicksLimit: 6 } },
          y: { beginAtZero: true, ticks: { color: inkMuted, precision: 0 }, grid: { color: gridColor } },
        },
      },
    });
  }

  /**
   * One horizontal swimlane per alarm flag active at some point in the
   * period, one floating bar per active interval — replaces the old raw
   * unitAlarmStatus1/2/shortAlarmStatus value charts (sections 24-27):
   * multiple simultaneous alarms no longer overlap into an unreadable
   * superposition of numbers, each segment shows exactly when that specific
   * alarm was on, and colour follows the same orange/red criticality used
   * everywhere else rather than a per-series palette.
   */
  private renderTimeline(): void {
    const canvas = this.timelineCanvasRef?.nativeElement;
    const rows = this.timelineRows();
    if (!canvas || rows.length === 0) return;

    const { gridColor, inkMuted, crit, warn } = this.chartTheme();
    const lang = this.i18n.lang();
    const locale = lang === 'fr' ? 'fr-CA' : 'en-US';
    const { start: windowStart, end: windowEnd } = this.timelineWindow;
    const multiDay = this.historyHours() > 24;
    const fmt = (ms: number) =>
      new Date(ms).toLocaleString(locale, multiDay
        ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' }
      );
    const durationLabel = (ms: number) => {
      const minutes = Math.max(1, Math.round(ms / 60000));
      if (minutes < 60) return `${minutes}min`;
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest ? `${hours}h${rest}` : `${hours}h`;
    };

    const labels = rows.map((r) => translateAlarmLabel(r.flag, lang).split(' - ')[0]);

    // One dataset per segment rather than one flat dataset for every segment:
    // Chart.js's category axis resolves a bar's row by the *array position*
    // of its data point, not by matching an object's `y` value — so packing
    // every segment (many more than there are rows) into a single dataset's
    // array made most of them line up with the wrong row, or no row at all.
    // Each dataset here is padded with `null` everywhere except its own
    // row's index, and `grouped: false` stops Chart.js dividing each row's
    // width by however many datasets exist (which would squash every bar to
    // a sliver) — every dataset instead independently claims the full row.
    const datasets = rows.flatMap((row, i) =>
      row.segments.map((s) => {
        const data = new Array(rows.length).fill(null);
        data[i] = [s.start, s.end];
        return {
          data,
          backgroundColor: row.criticality === 'critical' ? crit : warn,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
          grouped: false,
          meta: { start: s.start, end: s.end, ongoing: s.end >= windowEnd },
        };
      })
    );

    this.timelineChart?.destroy();
    this.timelineChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: datasets as any },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => (items[0]?.label as string) ?? '',
              label: (ctx) => {
                const meta = (ctx.dataset as any).meta as { start: number; end: number; ongoing: boolean };
                const range = `${fmt(meta.start)} → ${meta.ongoing ? this.i18n.t('controllerDetail.timelineOngoing') : fmt(meta.end)}`;
                return [range, `${this.i18n.t('controllerDetail.timelineDuration')}: ${durationLabel(meta.end - meta.start)}`];
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: windowStart,
            max: windowEnd,
            grid: { color: gridColor },
            ticks: { color: inkMuted, maxTicksLimit: 6, callback: (v) => fmt(Number(v)) },
          },
          y: {
            type: 'category',
            labels,
            grid: { color: gridColor },
            ticks: { color: inkMuted },
          },
        },
      },
    });
  }
}
