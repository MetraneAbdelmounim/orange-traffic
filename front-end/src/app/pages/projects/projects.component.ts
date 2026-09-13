import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../models/project';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';

const FOLDER_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-19.5 0v6a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-6m-19.5 0h19.5M4.5 9.75V6a2.25 2.25 0 012.25-2.25h5.379a1.5 1.5 0 011.06.44l1.622 1.62a1.5 1.5 0 001.06.44H19.5A2.25 2.25 0 0121.75 8.25v1.5" /></svg>`;

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, ModalComponent, SafeHtmlPipe],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-8">
      <app-page-header title="Projets" subtitle="Chaque contrôleur ATC-1500 est rattaché à un projet." [icon]="folderIcon">
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary" (click)="showForm.set(true)">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nouveau projet
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
          <p class="text-ink font-medium">Aucun projet pour l'instant</p>
          <p class="text-sm text-ink-muted mt-1">Créez un projet pour commencer à rattacher des contrôleurs.</p>
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (project of projects(); track project._id) {
            <a
              [routerLink]="['/projects', project._id]"
              class="card card-interactive card-accent p-5 flex flex-col gap-3"
              [class.is-crit]="(project.alarmCount ?? 0) > 0"
              [class.is-good]="(project.alarmCount ?? 0) === 0 && (project.controllerCount ?? 0) > 0"
              [class.is-neutral]="!project.controllerCount"
            >
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
                    <span class="chip-dot"></span>{{ project.controllerCount }} contrôleur{{ project.controllerCount === 1 ? '' : 's' }}
                  </span>
                  @if (project.alarmCount) {
                    <span class="chip chip-crit"><span class="chip-dot"></span>{{ project.alarmCount }} en alarme</span>
                  }
                  @if (project.offlineCount) {
                    <span class="chip chip-warn"><span class="chip-dot"></span>{{ project.offlineCount }} injoignable{{ project.offlineCount === 1 ? '' : 's' }}</span>
                  }
                </div>
              }
            </a>
          }
        </div>
      }
    </div>

    <app-modal [open]="showForm()" title="Nouveau projet" [hasFooter]="false" (closed)="showForm.set(false)">
      <form class="flex flex-col gap-4" (ngSubmit)="createProject()">
        <div>
          <label class="label" for="nom">Nom</label>
          <input id="nom" name="nom" class="field" [(ngModel)]="newNom" required />
        </div>
        <div>
          <label class="label" for="description">Description</label>
          <input id="description" name="description" class="field" [(ngModel)]="newDescription" placeholder="Optionnel" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  auth = inject(AuthService);

  folderIcon = FOLDER_ICON;
  projects = signal<Project[]>([]);
  loading = signal(true);
  showForm = signal(false);
  newNom = '';
  newDescription = '';

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
}
