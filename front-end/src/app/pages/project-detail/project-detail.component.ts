import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { controllerUiUrl, hasCoordinates, modemUiUrl, streetViewUrl } from '../../core/controller-links';
import { AuthService } from '../../core/services/auth.service';
import { ControllerService } from '../../core/services/controller.service';
import { ProjectService } from '../../core/services/project.service';
import { Controller } from '../../models/controller';
import { Project } from '../../models/project';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';
import { SignalBadgeComponent } from '../../ui/signal-badge.component';
import { downloadControllerReport } from './controller-report';
import { ProjectMapComponent } from './project-map.component';

const CONTROLLER_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;
const EDIT_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>`;
const MAP_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>`;
const REPORT_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;

const STREET_VIEW_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>`;
const DEVICE_LINK_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;
const MODEM_LINK_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>`;

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
  ],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-8">
      <app-page-header
        [title]="project()?.nom || ''"
        [subtitle]="project()?.description"
        [icon]="controllerIcon"
        [backLink]="['/projects']"
        backLabel="Projets"
      >
        <button type="button" class="btn btn-ghost" [disabled]="!controllers().length" (click)="downloadReport()">
          <span [innerHTML]="reportIcon | safeHtml"></span>
          Rapport
        </button>
        @if (controllers().length) {
          <button type="button" class="btn btn-ghost" (click)="showMap.set(!showMap())">
            <span [innerHTML]="mapIcon | safeHtml"></span>
            {{ showMap() ? 'Masquer la carte' : 'Carte' }}
          </button>
        }
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nouveau contrôleur
          </button>
        }
      </app-page-header>

      @if (showMap() && controllers().length) {
        <div class="mb-6">
          <app-project-map [controllers]="controllers()" />
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
          <p class="text-ink font-medium">Aucun contrôleur dans ce projet</p>
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (controller of controllers(); track controller._id) {
            <div
              class="card card-interactive card-accent p-5 flex flex-col gap-3 relative"
              [class.is-crit]="controller.status && controller.lastSnapshot.activeFlags.length > 0"
              [class.is-good]="controller.status && controller.lastSnapshot.activeFlags.length === 0"
              [class.is-neutral]="!controller.status"
            >
              @if (auth.isAdmin()) {
                <button
                  type="button"
                  class="icon-btn absolute top-4 right-4"
                  title="Modifier"
                  (click)="openEdit(controller); $event.stopPropagation()"
                >
                  <span [innerHTML]="editIcon | safeHtml"></span>
                </button>
              }
              <a [routerLink]="['/controllers', controller._id]" class="flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2 pr-8">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="icon-badge" [innerHTML]="controllerIcon | safeHtml"></span>
                    <div class="min-w-0">
                      <h2 class="font-semibold text-ink truncate">{{ controller.nom }}</h2>
                      <p class="text-xs text-ink-muted font-mono mt-0.5">{{ controller.ip }}</p>
                    </div>
                  </div>
                </div>
                <app-signal-badge [snapshot]="controller.lastSnapshot" [reachable]="controller.status" />
                <p class="text-xs text-ink-muted">{{ controller.model }}</p>
              </a>
              <div class="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                @if (hasCoords(controller)) {
                  <a [href]="streetViewLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                    <span [innerHTML]="streetViewIcon | safeHtml"></span>Street View
                  </a>
                }
                <a [href]="controllerUiLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                  <span [innerHTML]="deviceLinkIcon | safeHtml"></span>Contrôleur
                </a>
                <a [href]="modemLink(controller)" target="_blank" rel="noopener" class="link-chip" (click)="$event.stopPropagation()">
                  <span [innerHTML]="modemLinkIcon | safeHtml"></span>Modem
                </a>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-modal
      [open]="showForm()"
      [title]="editing() ? 'Modifier ' + editing()!.nom : 'Nouveau contrôleur'"
      [hasFooter]="false"
      (closed)="showForm.set(false)"
    >
      <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="submit()">
        <div>
          <label class="label" for="nom">Nom</label>
          <input id="nom" name="nom" class="field" [(ngModel)]="form.nom" required />
        </div>
        <div>
          <label class="label" for="ip">Adresse IP</label>
          <input id="ip" name="ip" class="field" [(ngModel)]="form.ip" placeholder="10.8.3.20" required />
        </div>
        <div>
          <label class="label" for="port">Port SNMP</label>
          <input id="port" name="port" type="number" class="field" [(ngModel)]="form.port" />
        </div>
        <div>
          <label class="label" for="community">Communauté SNMP</label>
          <input id="community" name="community" class="field" [(ngModel)]="form.community" placeholder="public" />
        </div>
        <div>
          <label class="label" for="latitude">Latitude</label>
          <input id="latitude" name="latitude" type="number" step="any" class="field" [(ngModel)]="form.latitude" placeholder="31.6295" />
          <p class="mt-1 text-xs text-ink-muted">Entre -90 et 90</p>
        </div>
        <div>
          <label class="label" for="longitude">Longitude</label>
          <input id="longitude" name="longitude" type="number" step="any" class="field" [(ngModel)]="form.longitude" placeholder="-7.9811" />
          <p class="mt-1 text-xs text-ink-muted">Entre -180 et 180</p>
        </div>

        @if (formError()) {
          <p class="sm:col-span-2 chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
        }

        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary">{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
        </div>
      </form>
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
    `,
  ],
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private controllerService = inject(ControllerService);
  auth = inject(AuthService);

  controllerIcon = CONTROLLER_ICON;
  editIcon = EDIT_ICON;
  mapIcon = MAP_ICON;
  reportIcon = REPORT_ICON;
  streetViewIcon = STREET_VIEW_ICON;
  deviceLinkIcon = DEVICE_LINK_ICON;
  modemLinkIcon = MODEM_LINK_ICON;

  project = signal<Project | null>(null);
  controllers = signal<Controller[]>([]);
  loading = signal(true);
  showForm = signal(false);
  showMap = signal(false);
  editing = signal<Controller | null>(null);
  formError = signal<string | null>(null);
  form: FormState = { ...EMPTY_FORM };

  private projectId!: string;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')!;
    this.projectService.getById(this.projectId).subscribe((p) => this.project.set(p));
    this.load();
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
      return 'Latitude invalide (doit être entre -90 et 90)';
    }
    if (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) {
      return 'Longitude invalide (doit être entre -180 et 180)';
    }
    if ((latitude === null) !== (longitude === null)) {
      return 'Latitude et longitude doivent être renseignées ensemble';
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
      error: (err) => this.formError.set(err?.error?.error || 'Échec de l’enregistrement'),
    });
  }

  downloadReport(): void {
    void downloadControllerReport(this.project(), this.controllers());
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
