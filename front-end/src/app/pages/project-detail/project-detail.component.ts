import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, catchError, exhaustMap, of } from 'rxjs';
import { refreshWhileVisible } from '../../core/auto-refresh';
import { controllerUiUrl, hasCoordinates, modemUiUrl, streetViewUrl } from '../../core/controller-links';
import { AuthService } from '../../core/services/auth.service';
import { ControllerService } from '../../core/services/controller.service';
import { ProjectService } from '../../core/services/project.service';
import { translateApiError } from '../../i18n/backend-errors';
import { TranslationKey } from '../../i18n/fr';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { Controller, ProjectKpi } from '../../models/controller';
import { Project } from '../../models/project';
import { LiveIndicatorComponent } from '../../ui/live-indicator.component';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';
import { SignalBadgeComponent } from '../../ui/signal-badge.component';
import { StatTileComponent } from '../../ui/stat-tile.component';
import { downloadControllersCsv } from './controller-csv';
import { downloadControllerReport } from './controller-report';
import { ProjectMapComponent } from './project-map.component';

const CONTROLLER_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;
const EDIT_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>`;
const MAP_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>`;
const REPORT_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
const KPI_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>`;
const BELL_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>`;

const STREET_VIEW_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>`;
const DEVICE_LINK_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;
const MODEM_LINK_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>`;
const TRASH_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>`;

type FormState = {
  nom: string;
  ip: string;
  port: number;
  community: string;
  latitude: number | null;
  longitude: number | null;
};

const EMPTY_FORM: FormState = { nom: '', ip: '', port: 161, community: 'public', latitude: null, longitude: null };

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    SignalBadgeComponent,
    ModalComponent,
    SafeHtmlPipe,
    ProjectMapComponent,
    LiveIndicatorComponent,
    StatTileComponent,
    TranslatePipe,
  ],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-8">
      <div class="flex justify-end mb-2">
        <app-live-indicator [live]="liveConnected()" [lastUpdate]="lastUpdate()" />
      </div>
      <app-page-header
        [title]="project()?.nom || ''"
        [subtitle]="project()?.description"
        [icon]="controllerIcon"
        [backLink]="['/projects']"
        [backLabel]="'nav.projects' | t"
      >
        <div class="relative">
          <button type="button" class="btn btn-ghost" [disabled]="!controllers().length" (click)="exportMenuOpen.set(!exportMenuOpen())">
            <span [innerHTML]="reportIcon | safeHtml"></span>
            {{ 'reports.export' | t }}
          </button>
          @if (exportMenuOpen()) {
            <div class="export-menu">
              <button type="button" class="export-menu-item" (click)="downloadReport(); exportMenuOpen.set(false)">
                {{ 'reports.exportPdf' | t }}
              </button>
              <button type="button" class="export-menu-item" (click)="downloadCsv(); exportMenuOpen.set(false)">
                {{ 'reports.exportCsv' | t }}
              </button>
            </div>
          }
        </div>
        @if (controllers().length) {
          <button type="button" class="btn btn-ghost" (click)="showMap.set(!showMap())">
            <span [innerHTML]="mapIcon | safeHtml"></span>
            {{ (showMap() ? 'projectDetail.hideMap' : 'projectDetail.map') | t }}
          </button>
          <button type="button" class="btn btn-ghost" (click)="toggleKpi()">
            <span [innerHTML]="kpiIcon | safeHtml"></span>
            {{ (showKpi() ? 'projectDetail.hideKpi' : 'projectDetail.kpi') | t }}
          </button>
        }
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {{ 'controllers.new' | t }}
          </button>
        }
      </app-page-header>

      @if (showMap() && controllers().length) {
        <div class="mb-6">
          <app-project-map [controllers]="controllers()" />
        </div>
      }

      @if (showKpi()) {
        <div class="card p-5 mb-6 flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-semibold text-ink">{{ 'projectDetail.kpi' | t }}</h2>
            <div class="flex flex-wrap gap-1.5">
              @for (opt of kpiPeriods; track opt.days) {
                <button
                  type="button"
                  class="btn"
                  [class.btn-primary]="kpiDays() === opt.days"
                  [class.btn-ghost]="kpiDays() !== opt.days"
                  (click)="setKpiDays(opt.days)"
                >
                  {{ opt.key | t }}
                </button>
              }
            </div>
          </div>

          @if (kpiLoading()) {
            <div class="grid gap-4 sm:grid-cols-3">
              @for (i of [1, 2, 3]; track i) {
                <div class="card h-24 skeleton"></div>
              }
            </div>
          } @else if (kpi()) {
            @if (kpi(); as k) {
              <div class="grid gap-4 sm:grid-cols-3">
                <app-stat-tile
                  [label]="'kpi.availability' | t"
                  [value]="k.summary.avgUptimePercent !== null ? (k.summary.avgUptimePercent + ' %') : ('kpi.noData' | t)"
                  [icon]="kpiIcon"
                  tone="good"
                />
                <app-stat-tile [label]="'kpi.alarmFrequency' | t" [value]="k.summary.totalAlarmCount" [icon]="bellIcon" tone="crit" />
                <app-stat-tile [label]="'kpi.controllerCount' | t" [value]="k.summary.controllerCount" [icon]="controllerIcon" tone="brand" />
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      <th class="pb-2">{{ 'projectDetail.name' | t }}</th>
                      <th class="pb-2">{{ 'kpi.uptimeColumn' | t }}</th>
                      <th class="pb-2">{{ 'kpi.alarmsColumn' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of k.controllers; track row.controllerId) {
                      <tr class="table-row">
                        <td class="py-2">
                          {{ row.nom }}
                          @if (row.maintenanceMode) {
                            <span class="chip chip-warn ml-1"><span class="chip-dot"></span>{{ 'status.maintenance' | t }}</span>
                          }
                        </td>
                        <td class="py-2">
                          @if (row.uptimePercent === null) {
                            <span class="chip chip-neutral"><span class="chip-dot"></span>{{ 'kpi.noData' | t }}</span>
                          } @else {
                            <span class="chip" [class.chip-good]="row.uptimePercent >= 99" [class.chip-warn]="row.uptimePercent >= 95 && row.uptimePercent < 99" [class.chip-crit]="row.uptimePercent < 95">
                              <span class="chip-dot"></span>{{ row.uptimePercent }} %
                            </span>
                          }
                        </td>
                        <td class="py-2 tnum">{{ row.alarmCount }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </div>
      }

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card h-32 skeleton"></div>
          }
        </div>
      } @else if (controllers().length === 0) {
        <div class="card p-12 text-center">
          <span class="icon-badge mx-auto mb-4" [innerHTML]="controllerIcon | safeHtml"></span>
          <p class="text-ink font-medium">{{ 'projectDetail.noControllers' | t }}</p>
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (controller of controllers(); track controller._id) {
            <div
              class="card card-interactive card-accent p-5 flex flex-col gap-3 relative"
              [class.is-crit]="!controller.maintenanceMode && controller.status && controller.lastSnapshot.activeFlags.length > 0"
              [class.is-good]="!controller.maintenanceMode && controller.status && controller.lastSnapshot.activeFlags.length === 0"
              [class.is-neutral]="!controller.maintenanceMode && !controller.status"
              [class.is-maintenance]="controller.maintenanceMode"
            >
              @if (auth.isAdmin()) {
                <div class="absolute top-4 right-4 flex gap-1.5">
                  <button
                    type="button"
                    class="icon-btn"
                    [title]="'common.edit' | t"
                    (click)="openEdit(controller); $event.stopPropagation()"
                  >
                    <span [innerHTML]="editIcon | safeHtml"></span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-danger"
                    [title]="'common.delete' | t"
                    (click)="openDeleteController(controller); $event.stopPropagation()"
                  >
                    <span [innerHTML]="trashIcon | safeHtml"></span>
                  </button>
                </div>
              }
              <a [routerLink]="['/controllers', controller._id]" class="flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2 pr-16">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="icon-badge" [innerHTML]="controllerIcon | safeHtml"></span>
                    <div class="min-w-0">
                      <h2 class="font-semibold text-ink truncate">{{ controller.nom }}</h2>
                      <p class="text-xs text-ink-muted font-mono mt-0.5">{{ controller.ip }}</p>
                    </div>
                  </div>
                </div>
                <app-signal-badge [snapshot]="controller.lastSnapshot" [reachable]="controller.status" [maintenance]="controller.maintenanceMode" />
                <p class="text-xs text-ink-muted">{{ controller.model }}</p>
              </a>
              <div class="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                @if (hasCoords(controller)) {
                  <a [href]="streetViewLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                    <span [innerHTML]="streetViewIcon | safeHtml"></span>{{ 'projectDetail.streetView' | t }}
                  </a>
                }
                <a [href]="controllerUiLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                  <span [innerHTML]="deviceLinkIcon | safeHtml"></span>{{ 'projectDetail.controllerLink' | t }}
                </a>
                <a [href]="modemLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                  <span [innerHTML]="modemLinkIcon | safeHtml"></span>{{ 'projectDetail.modemLink' | t }}
                </a>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-modal
      [open]="showForm()"
      [title]="editing() ? (('common.edit' | t) + ' ' + editing()!.nom) : ('controllers.new' | t)"
      [hasFooter]="false"
      (closed)="showForm.set(false)"
    >
      <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="submit()">
        <div>
          <label class="label" for="nom">{{ 'projectDetail.name' | t }}</label>
          <input id="nom" name="nom" class="field" [(ngModel)]="form.nom" required />
        </div>
        <div>
          <label class="label" for="ip">{{ 'projectDetail.ipAddress' | t }}</label>
          <input id="ip" name="ip" class="field" [(ngModel)]="form.ip" placeholder="10.8.3.20" required />
        </div>
        <div>
          <label class="label" for="port">{{ 'projectDetail.snmpPort' | t }}</label>
          <input id="port" name="port" type="number" class="field" [(ngModel)]="form.port" />
        </div>
        <div>
          <label class="label" for="community">{{ 'projectDetail.snmpCommunity' | t }}</label>
          <input id="community" name="community" class="field" [(ngModel)]="form.community" placeholder="public" />
        </div>
        <div>
          <label class="label" for="latitude">{{ 'projectDetail.latitude' | t }}</label>
          <input id="latitude" name="latitude" type="number" step="any" class="field" [(ngModel)]="form.latitude" placeholder="31.6295" />
          <p class="mt-1 text-xs text-ink-muted">{{ 'projectDetail.latitudeRange' | t }}</p>
        </div>
        <div>
          <label class="label" for="longitude">{{ 'projectDetail.longitude' | t }}</label>
          <input id="longitude" name="longitude" type="number" step="any" class="field" [(ngModel)]="form.longitude" placeholder="-7.9811" />
          <p class="mt-1 text-xs text-ink-muted">{{ 'projectDetail.longitudeRange' | t }}</p>
        </div>

        @if (formError()) {
          <p class="sm:col-span-2 chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
        }

        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">{{ 'common.cancel' | t }}</button>
          <button type="submit" class="btn btn-primary">{{ (editing() ? 'common.save' : 'projectDetail.add') | t }}</button>
        </div>
      </form>
    </app-modal>

    <app-modal [open]="!!deletingController()" [title]="'controllers.deleteTitle' | t" size="sm" (closed)="deletingController.set(null)">
      <p class="text-sm text-ink-secondary">
        <strong class="text-ink">{{ deletingController()?.nom }}</strong> — {{ 'controllers.deleteBody' | t }}
      </p>
      @if (deleteControllerError()) {
        <p class="mt-3 chip chip-crit self-start"><span class="chip-dot"></span>{{ deleteControllerError() }}</p>
      }
      <ng-container modalFooter>
        <button type="button" class="btn btn-ghost" (click)="deletingController.set(null)">{{ 'common.cancel' | t }}</button>
        <button type="button" class="btn btn-danger" (click)="confirmDeleteController()" [disabled]="deleteControllerBusy()">
          {{ (deleteControllerBusy() ? 'common.loading' : 'common.deletePermanently') | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: [
    `
      .icon-btn {
        display: flex;
        height: 2rem;
        width: 2rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        border: 1px solid var(--line);
        background-color: var(--surface);
        color: var(--ink-muted);
        transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
      }
      .icon-btn:hover {
        background-color: var(--surface-hover);
        color: var(--brand-ink);
      }
      .export-menu {
        position: absolute;
        top: calc(100% + 0.4rem);
        left: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        min-width: 11rem;
        padding: 0.4rem;
        border-radius: 0.65rem;
        border: 1px solid var(--line);
        background-color: var(--surface);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
      }
      .export-menu-item {
        padding: 0.5rem 0.65rem;
        border-radius: 0.5rem;
        text-align: left;
        font-size: 0.875rem;
        color: var(--ink);
      }
      .export-menu-item:hover {
        background-color: var(--surface-hover);
      }
    `,
  ],
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private controllerService = inject(ControllerService);
  private i18n = inject(I18nService);
  auth = inject(AuthService);

  controllerIcon = CONTROLLER_ICON;
  editIcon = EDIT_ICON;
  mapIcon = MAP_ICON;
  reportIcon = REPORT_ICON;
  streetViewIcon = STREET_VIEW_ICON;
  deviceLinkIcon = DEVICE_LINK_ICON;
  modemLinkIcon = MODEM_LINK_ICON;
  trashIcon = TRASH_ICON;
  kpiIcon = KPI_ICON;
  bellIcon = BELL_ICON;

  kpiPeriods: { key: TranslationKey; days: number }[] = [
    { key: 'kpi.period7d', days: 7 },
    { key: 'kpi.period30d', days: 30 },
    { key: 'kpi.period90d', days: 90 },
  ];
  showKpi = signal(false);
  kpi = signal<ProjectKpi | null>(null);
  kpiLoading = signal(false);
  kpiDays = signal(30);

  project = signal<Project | null>(null);
  controllers = signal<Controller[]>([]);
  loading = signal(true);
  showForm = signal(false);
  showMap = signal(false);
  editing = signal<Controller | null>(null);
  formError = signal<string | null>(null);
  form: FormState = { ...EMPTY_FORM };

  exportMenuOpen = signal(false);

  deletingController = signal<Controller | null>(null);
  deleteControllerBusy = signal(false);
  deleteControllerError = signal<string | null>(null);

  liveConnected = signal(true);
  lastUpdate = signal<Date | null>(null);
  private liveSub?: Subscription;

  private projectId!: string;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')!;
    this.projectService.getById(this.projectId).subscribe((p) => this.project.set(p));
    this.load();
    this.lastUpdate.set(new Date());

    this.liveSub = refreshWhileVisible()
      .pipe(
        exhaustMap(() =>
          this.controllerService.getByProject(this.projectId).pipe(catchError(() => of(null)))
        )
      )
      .subscribe((controllers) => {
        if (controllers) {
          this.controllers.set(controllers);
          this.liveConnected.set(true);
          this.lastUpdate.set(new Date());
        } else {
          this.liveConnected.set(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  load(): void {
    this.loading.set(true);
    this.controllerService.getByProject(this.projectId).subscribe({
      next: (controllers) => {
        this.controllers.set(controllers);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleKpi(): void {
    const next = !this.showKpi();
    this.showKpi.set(next);
    if (next && !this.kpi()) this.loadKpi();
  }

  setKpiDays(days: number): void {
    if (this.kpiDays() === days) return;
    this.kpiDays.set(days);
    this.loadKpi();
  }

  private loadKpi(): void {
    this.kpiLoading.set(true);
    this.projectService.getKpi(this.projectId, this.kpiDays()).subscribe({
      next: (k) => {
        this.kpi.set(k);
        this.kpiLoading.set(false);
      },
      error: () => this.kpiLoading.set(false),
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { ...EMPTY_FORM };
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(controller: Controller): void {
    this.editing.set(controller);
    this.form = {
      nom: controller.nom,
      ip: controller.ip,
      port: controller.port,
      community: 'public',
      latitude: controller.latitude || null,
      longitude: controller.longitude || null,
    };
    this.formError.set(null);
    this.showForm.set(true);
  }

  /** Coordinates are optional, but if given must be real geographic values. */
  private validateCoordinates(): string | null {
    const { latitude, longitude } = this.form;
    if (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) {
      return this.i18n.t('projectDetail.invalidLatitude');
    }
    if (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) {
      return this.i18n.t('projectDetail.invalidLongitude');
    }
    if ((latitude === null) !== (longitude === null)) {
      return this.i18n.t('projectDetail.coordinatesTogether');
    }
    return null;
  }

  submit(): void {
    if (!this.form.nom.trim() || !this.form.ip.trim()) return;

    const coordError = this.validateCoordinates();
    if (coordError) {
      this.formError.set(coordError);
      return;
    }
    this.formError.set(null);

    const payload = {
      nom: this.form.nom,
      ip: this.form.ip,
      port: this.form.port,
      community: this.form.community,
      latitude: this.form.latitude ?? 0,
      longitude: this.form.longitude ?? 0,
    };

    const editing = this.editing();
    const request = editing
      ? this.controllerService.update(editing._id, payload)
      : this.controllerService.add({ ...payload, project: this.projectId as any });

    request.subscribe({
      next: () => {
        this.showForm.set(false);
        this.load();
      },
      error: (err) => this.formError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('projectDetail.saveFailed')),
    });
  }

  downloadReport(): void {
    void downloadControllerReport(this.project(), this.controllers());
  }

  downloadCsv(): void {
    downloadControllersCsv(this.project(), this.controllers());
  }

  openDeleteController(controller: Controller): void {
    this.deleteControllerError.set(null);
    this.deletingController.set(controller);
  }

  confirmDeleteController(): void {
    const controller = this.deletingController();
    if (!controller) return;
    this.deleteControllerBusy.set(true);
    this.controllerService.delete(controller._id).subscribe({
      next: () => {
        this.deleteControllerBusy.set(false);
        this.deletingController.set(null);
        this.load();
      },
      error: (err) => {
        this.deleteControllerBusy.set(false);
        this.deleteControllerError.set(
          translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('controllers.deleteFailed')
        );
      },
    });
  }

  hasCoords(c: Controller): boolean {
    return hasCoordinates(c);
  }

  streetViewLink(c: Controller): string {
    return streetViewUrl(c);
  }

  controllerUiLink(c: Controller): string {
    return controllerUiUrl(c);
  }

  modemLink(c: Controller): string {
    return modemUiUrl(c);
  }
}
