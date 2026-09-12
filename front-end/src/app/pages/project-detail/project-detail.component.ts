import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ControllerService } from '../../core/services/controller.service';
import { ProjectService } from '../../core/services/project.service';
import { Controller } from '../../models/controller';
import { Project } from '../../models/project';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';
import { SignalBadgeComponent } from '../../ui/signal-badge.component';

const CONTROLLER_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>`;

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, SignalBadgeComponent, ModalComponent, SafeHtmlPipe],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-8">
      <app-page-header
        [title]="project()?.nom || ''"
        [subtitle]="project()?.description"
        [icon]="controllerIcon"
        [backLink]="['/projects']"
        backLabel="Projets"
      >
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary" (click)="showForm.set(true)">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nouveau contrôleur
          </button>
        }
      </app-page-header>

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
            <a
              [routerLink]="['/controllers', controller._id]"
              class="card card-interactive card-accent p-5 flex flex-col gap-3"
              [class.is-crit]="controller.status && controller.lastSnapshot.activeFlags.length > 0"
              [class.is-good]="controller.status && controller.lastSnapshot.activeFlags.length === 0"
              [class.is-neutral]="!controller.status"
            >
              <div class="flex items-start justify-between gap-2">
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
          }
        </div>
      }
    </div>

    <app-modal [open]="showForm()" title="Nouveau contrôleur" [hasFooter]="false" (closed)="showForm.set(false)">
      <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="createController()">
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
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary">Ajouter</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private controllerService = inject(ControllerService);
  auth = inject(AuthService);

  controllerIcon = CONTROLLER_ICON;
  project = signal<Project | null>(null);
  controllers = signal<Controller[]>([]);
  loading = signal(true);
  showForm = signal(false);
  form = { nom: '', ip: '', port: 161, community: 'public' };

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

  createController(): void {
    if (!this.form.nom.trim() || !this.form.ip.trim()) return;
    this.controllerService.add({ ...this.form, project: this.projectId as any }).subscribe(() => {
      this.form = { nom: '', ip: '', port: 161, community: 'public' };
      this.showForm.set(false);
      this.load();
    });
  }
}
