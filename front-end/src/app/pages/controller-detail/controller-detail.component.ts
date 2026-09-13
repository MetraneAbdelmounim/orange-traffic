import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AlarmEventService } from '../../core/services/alarm-event.service';
import { ControllerService } from '../../core/services/controller.service';
import { AlarmEvent } from '../../models/alarm-event';
import { Controller, ControllerHistory } from '../../models/controller';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';
import { SignalBadgeComponent } from '../../ui/signal-badge.component';
import { StatTileComponent } from '../../ui/stat-tile.component';

Chart.register(...registerables);

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

/** Formats SNMP sysUpTime centiseconds (TimeTicks) as "3j 4h12m". */
function formatUptime(ticks: number | null): string {
  if (ticks === null || ticks === undefined) return '—';
  const totalSeconds = Math.floor(ticks / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}j`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

@Component({
  selector: 'app-controller-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SignalBadgeComponent, StatTileComponent, SafeHtmlPipe],
  template: `
    @if (controller(); as c) {
      <div class="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <a [routerLink]="['/projects', projectId(c)]" class="text-sm text-ink-muted hover:text-ink">← Projet</a>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="icon-badge" [innerHTML]="icon.controller | safeHtml"></span>
            <div>
              <h1 class="text-2xl font-bold tracking-tight text-ink">{{ c.nom }}</h1>
              <p class="text-sm text-ink-muted font-mono mt-1">{{ c.ip }}:{{ c.port }} · {{ c.model }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <app-signal-badge [snapshot]="c.lastSnapshot" [reachable]="c.status" />
            <button type="button" class="btn btn-primary" [disabled]="polling()" (click)="pollNow()">
              {{ polling() ? 'Sondage…' : 'Rafraîchir maintenant' }}
            </button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <app-stat-tile
            label="Dernière lecture"
            [value]="(c.lastSnapshot.measuredAt | date: 'medium') || '—'"
            [icon]="icon.clock"
            tone="brand"
          />
          <app-stat-tile label="Uptime SNMP" [value]="uptime()" hint="Depuis le dernier redémarrage" [icon]="icon.pulse" tone="good" />
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
            <h2 class="font-semibold text-ink">Alarmes NTCIP 1202</h2>
          </div>
          @if (!c.lastSnapshot.alarms.length) {
            <p class="chip chip-good"><span class="chip-dot"></span>Aucune alarme active</p>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (alarm of c.lastSnapshot.alarms; track alarm.label) {
                <li class="chip" [class.chip-crit]="alarm.criticality === 'critical'" [class.chip-warn]="alarm.criticality === 'warning'">
                  <span class="chip-dot"></span>{{ alarm.label }}
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
              <h2 class="font-semibold text-ink">Statut détaillé (phases / détecteurs)</h2>
              <span class="chip chip-neutral">non confirmé pour ce modèle</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 text-sm">
              @if (c.lastSnapshot.phaseStatus) {
                <div>
                  <p class="text-xs text-ink-muted mb-1">Phases</p>
                  @for (kv of objectEntries(c.lastSnapshot.phaseStatus); track kv[0]) {
                    <p class="tnum">{{ kv[0] }} = {{ kv[1] }}</p>
                  }
                </div>
              }
              @if (c.lastSnapshot.detectorStatus) {
                <div>
                  <p class="text-xs text-ink-muted mb-1">Détecteurs</p>
                  @for (kv of objectEntries(c.lastSnapshot.detectorStatus); track kv[0]) {
                    <p class="tnum">{{ kv[0] }} = {{ kv[1] }}</p>
                  }
                </div>
              }
            </div>
          </div>
        }

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="icon-badge" [innerHTML]="icon.chart | safeHtml"></span>
            <h2 class="font-semibold text-ink">Historique (24h)</h2>
          </div>
          <canvas #historyCanvas height="80"></canvas>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-4">
            <span class="icon-badge" [innerHTML]="icon.history | safeHtml"></span>
            <h2 class="font-semibold text-ink">Journal des alarmes</h2>
          </div>
          @if (events().length === 0) {
            <p class="text-sm text-ink-muted">Aucune transition d'alarme enregistrée.</p>
          } @else {
            <ul class="flex flex-col">
              @for (event of pagedEvents(); track event._id) {
                <li class="table-row py-2 flex items-center justify-between gap-3 text-sm">
                  <span class="flex items-center gap-2">
                    <span class="chip" [class.chip-crit]="event.state === 'active'" [class.chip-good]="event.state === 'cleared'">
                      <span class="chip-dot"></span>{{ event.state === 'active' ? 'Apparue' : 'Disparue' }}
                    </span>
                    {{ event.flag }}
                  </span>
                  <span class="text-ink-muted tnum">{{ event.occurredAt | date: 'medium' }}</span>
                </li>
              }
            </ul>
            @if (totalPages() > 1) {
              <div class="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-line">
                <button type="button" class="btn btn-ghost" [disabled]="page() === 1" (click)="page.set(page() - 1)">
                  ← Précédent
                </button>
                <span class="text-xs text-ink-muted">Page {{ page() }} / {{ totalPages() }}</span>
                <button type="button" class="btn btn-ghost" [disabled]="page() === totalPages()" (click)="page.set(page() + 1)">
                  Suivant →
                </button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
})
export class ControllerDetailComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private controllerService = inject(ControllerService);
  private alarmEventService = inject(AlarmEventService);

  icon = ICON;

  @ViewChild('historyCanvas') historyCanvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  private readonly PAGE_SIZE = 10;

  controller = signal<Controller | null>(null);
  events = signal<AlarmEvent[]>([]);
  polling = signal(false);
  page = signal(1);
  pagedEvents = computed(() => {
    const start = (this.page() - 1) * this.PAGE_SIZE;
    return this.events().slice(start, start + this.PAGE_SIZE);
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.events().length / this.PAGE_SIZE)));

  private controllerId!: string;
  private history?: ControllerHistory;

  ngOnInit(): void {
    this.controllerId = this.route.snapshot.paramMap.get('id')!;
    this.load();
  }

  ngAfterViewInit(): void {
    if (this.history) this.renderChart(this.history);
  }

  load(): void {
    this.controllerService.getById(this.controllerId).subscribe((c) => this.controller.set(c));
    this.alarmEventService.getByController(this.controllerId).subscribe((events) => {
      this.events.set(events);
      this.page.set(1);
    });
    this.controllerService.getHistory(this.controllerId).subscribe((history) => {
      this.history = history;
      this.renderChart(history);
    });
  }

  pollNow(): void {
    this.polling.set(true);
    this.controllerService.pollNow(this.controllerId).subscribe({
      next: () => {
        this.load();
        this.polling.set(false);
      },
      error: () => this.polling.set(false),
    });
  }

  uptime(): string {
    return formatUptime(this.controller()?.lastSnapshot.sysUpTimeTicks ?? null);
  }

  projectId(c: Controller): string {
    return typeof c.project === 'string' ? c.project : c.project?._id || '';
  }

  objectEntries(obj: Record<string, unknown>): [string, unknown][] {
    return Object.entries(obj);
  }

  private renderChart(history: ControllerHistory): void {
    const canvas = this.historyCanvas?.nativeElement;
    if (!canvas) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const lineColor = rootStyles.getPropertyValue('--chart-line').trim() || '#ff5a1f';
    const gridColor = rootStyles.getPropertyValue('--chart-grid').trim() || '#ece5df';
    const inkMuted = rootStyles.getPropertyValue('--ink-muted').trim() || '#756b6d';

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: history.readings.map((r) =>
          new Date(r.ts).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
        ),
        datasets: [
          {
            label: 'Alarmes actives',
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
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: inkMuted, maxTicksLimit: 8 },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: inkMuted },
            grid: { color: gridColor },
          },
        },
      },
    });
  }
}
