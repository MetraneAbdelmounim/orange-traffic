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
              class="card card-interactive card-accent p-5 flex flex-col gap-3 relative"
              [class.is-crit]="(project.alarmCount ?? 0) > 0"
              [class.is-good]="(project.alarmCount ?? 0) === 0 && (project.controllerCount ?? 0) > 0"
              [class.is-neutral]="!project.controllerCount"
            >
              @if (auth.isAdmin()) {
                <button
                  type="button"
                  class="icon-btn icon-btn-danger absolute top-4 right-4"
                  [title]="'projects.deleteProjectTooltip' | t"
                  (click)="openDelete(project); $event.stopPropagation()"
                >
                  <span [innerHTML]="trashIcon | safeHtml"></span>
                </button>
              }
              <a [routerLink]="['/projects', project._id]" class="flex flex-col gap-3">
                <div class="flex items-start justify-between pr-8">
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
                      <span class="chip-dot"></span>{{ project.controllerCount }} {{ 'projects.controllerWord' | t }}{{ project.controllerCount === 1 ? '' : 's' }}
                    </span>
                    @if (project.alarmCount) {
                      <span class="chip chip-crit"><span class="chip-dot"></span>{{ project.alarmCount }} {{ 'projects.inAlarm' | t }}</span>
                    }
                    @if (project.offlineCount) {
                      <span class="chip chip-warn"><span class="chip-dot"></span>{{ project.offlineCount }} {{ 'projects.unreachableWord' | t }}{{ project.offlineCount === 1 ? '' : 's' }}</span>
                    }
                    @if (project.maintenanceCount) {
                      <span class="chip chip-warn"><span class="chip-dot"></span>{{ project.maintenanceCount }} {{ 'status.maintenance' | t }}</span>
                    }
                  </div>
                }
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
