import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { Project } from '../../models/project';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';

const FOLDER_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-19.5 0v6a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-6m-19.5 0h19.5M4.5 9.75V6a2.25 2.25 0 012.25-2.25h5.379a1.5 1.5 0 011.06.44l1.622 1.62a1.5 1.5 0 001.06.44H19.5A2.25 2.25 0 0121.75 8.25v1.5" /></svg>`;
const TRASH_ICON = `<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>`;

// Small (14px) chip-prefix icons — same icon vocabulary as the rest of the
// app (controller-detail/project-detail reuse the same monitor/bell glyphs)
// so a chip's icon always means the same thing everywhere it appears.
const CONTROLLER_CHIP_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;
const ALARM_CHIP_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>`;
const UNREACHABLE_CHIP_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`;
const MAINTENANCE_CHIP_ICON = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>`;

/** One of the login page's hero photos, reused as the project card's header banner. */
const CARD_HEADER_IMAGE = 'assets/login/bg-highway.webp';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, ModalComponent, SafeHtmlPipe, TranslatePipe],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-8">
      <app-page-header [title]="'projects.title' | t" [subtitle]="'projects.subtitle' | t" [icon]="folderIcon">
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary" (click)="showForm.set(true)">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {{ 'projects.new' | t }}
          </button>
        }
      </app-page-header>

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card h-28 skeleton"></div>
          }
        </div>
      } @else if (projects().length === 0) {
        <div class="card p-12 text-center">
          <span class="icon-badge mx-auto mb-4" [innerHTML]="folderIcon | safeHtml"></span>
          <p class="text-ink font-medium">{{ 'projects.empty' | t }}</p>
          <p class="text-sm text-ink-muted mt-1">{{ 'projects.emptyHint' | t }}</p>
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (project of projects(); track project._id) {
            <div
              class="card card-interactive card-accent overflow-hidden flex flex-col relative"
              [class.is-crit]="(project.alarmCount ?? 0) > 0"
              [class.is-good]="(project.alarmCount ?? 0) === 0 && (project.controllerCount ?? 0) > 0"
              [class.is-neutral]="!project.controllerCount"
            >
              @if (auth.isAdmin()) {
                <button
                  type="button"
                  class="icon-btn icon-btn-danger absolute top-3 right-3 z-10"
                  [title]="'projects.deleteProjectTooltip' | t"
                  (click)="openDelete(project); $event.stopPropagation()"
                >
                  <span [innerHTML]="trashIcon | safeHtml"></span>
                </button>
              }
              <a [routerLink]="['/projects', project._id]" class="flex flex-col gap-3">
                <div class="h-24 w-full overflow-hidden bg-sunken">
                  <img [src]="cardHeaderImage" alt="" class="h-full w-full object-cover" />
                </div>
                <div class="flex flex-col gap-3 p-5 pt-3">
                  <div class="flex items-start justify-between">
                    <span class="icon-badge" [innerHTML]="folderIcon | safeHtml"></span>
                    <svg class="h-4 w-4 text-ink-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </div>
                  <div>
                    <h2 class="font-semibold text-ink">{{ project.nom }}</h2>
                    @if (project.description) {
                      <p class="text-sm text-ink-muted mt-1">{{ project.description }}</p>
                    }
                  </div>
                  @if (project.controllerCount !== undefined) {
                    <div class="flex flex-wrap gap-1.5 mt-auto pt-1">
                      <span class="chip chip-neutral">
                        <span [innerHTML]="controllerChipIcon | safeHtml"></span>
                        {{ project.controllerCount }} {{ 'projects.controllerWord' | t }}{{ project.controllerCount === 1 ? '' : 's' }}
                      </span>
                      @if (project.alarmCount) {
                        <span class="chip chip-crit">
                          <span [innerHTML]="alarmChipIcon | safeHtml"></span>
                          {{ project.alarmCount }} {{ 'projects.inAlarm' | t }}
                        </span>
                      }
                      @if (project.offlineCount) {
                        <span class="chip chip-warn">
                          <span [innerHTML]="unreachableChipIcon | safeHtml"></span>
                          {{ project.offlineCount }} {{ 'projects.unreachableWord' | t }}{{ project.offlineCount === 1 ? '' : 's' }}
                        </span>
                      }
                      @if (project.maintenanceCount) {
                        <span class="chip chip-warn">
                          <span [innerHTML]="maintenanceChipIcon | safeHtml"></span>
                          {{ project.maintenanceCount }} {{ 'status.maintenance' | t }}
                        </span>
                      }
                    </div>
                  }
                </div>
              </a>
            </div>
          }
        </div>
      }
    </div>

    <app-modal [open]="showForm()" [title]="'projects.new' | t" [hasFooter]="false" (closed)="showForm.set(false)">
      <form class="flex flex-col gap-4" (ngSubmit)="createProject()">
        <div>
          <label class="label" for="nom">{{ 'projects.name' | t }}</label>
          <input id="nom" name="nom" class="field" [(ngModel)]="newNom" required />
        </div>
        <div>
          <label class="label" for="description">{{ 'projects.description' | t }}</label>
          <input id="description" name="description" class="field" [(ngModel)]="newDescription" [placeholder]="'projects.descriptionPlaceholder' | t" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">{{ 'common.cancel' | t }}</button>
          <button type="submit" class="btn btn-primary">{{ 'common.create' | t }}</button>
        </div>
      </form>
    </app-modal>

    <app-modal [open]="!!deleting()" [title]="'projects.deleteTitle' | t" size="sm" (closed)="deleting.set(null)">
      <p class="text-sm text-ink-secondary">
        <strong class="text-ink">{{ deleting()?.nom }}</strong> — {{ 'projects.deleteBody' | t }}
      </p>
      @if (deleteError()) {
        <p class="mt-3 chip chip-crit self-start"><span class="chip-dot"></span>{{ deleteError() }}</p>
      }
      <ng-container modalFooter>
        <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">{{ 'common.cancel' | t }}</button>
        <button type="button" class="btn btn-danger" (click)="confirmDelete()" [disabled]="deletingBusy()">
          {{ deletingBusy() ? ('common.loading' | t) : ('common.deletePermanently' | t) }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private i18n = inject(I18nService);
  auth = inject(AuthService);

  folderIcon = FOLDER_ICON;
  trashIcon = TRASH_ICON;
  controllerChipIcon = CONTROLLER_CHIP_ICON;
  alarmChipIcon = ALARM_CHIP_ICON;
  unreachableChipIcon = UNREACHABLE_CHIP_ICON;
  maintenanceChipIcon = MAINTENANCE_CHIP_ICON;
  cardHeaderImage = CARD_HEADER_IMAGE;
  projects = signal<Project[]>([]);
  loading = signal(true);
  showForm = signal(false);
  newNom = '';
  newDescription = '';

  deleting = signal<Project | null>(null);
  deletingBusy = signal(false);
  deleteError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.projectService.getAll().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createProject(): void {
    if (!this.newNom.trim()) return;
    this.projectService.add({ nom: this.newNom, description: this.newDescription }).subscribe(() => {
      this.newNom = '';
      this.newDescription = '';
      this.showForm.set(false);
      this.load();
    });
  }

  openDelete(project: Project): void {
    this.deleteError.set(null);
    this.deleting.set(project);
  }

  confirmDelete(): void {
    const project = this.deleting();
    if (!project) return;
    this.deletingBusy.set(true);
    this.projectService.delete(project._id).subscribe({
      next: () => {
        this.deletingBusy.set(false);
        this.deleting.set(null);
        // Refetch rather than splice the local array — deleting a project
        // also changes aggregate counts on nothing else here, but a refetch
        // keeps this in lockstep with the backend as the source of truth.
        this.load();
      },
      error: (err) => {
        this.deletingBusy.set(false);
        this.deleteError.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('projects.deleteFailed'));
      },
    });
  }
}
