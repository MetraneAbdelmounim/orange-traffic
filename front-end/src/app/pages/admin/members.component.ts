import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../core/services/member.service';
import { ProjectService } from '../../core/services/project.service';
import { Member } from '../../models/member';
import { Project } from '../../models/project';
import { ModalComponent } from '../../ui/modal.component';
import { PageHeaderComponent } from '../../ui/page-header.component';
import { SafeHtmlPipe } from '../../ui/safe-html.pipe';

const MEMBERS_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`;

type FormState = { username: string; isAdmin: boolean; projects: string[] };

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, ModalComponent, SafeHtmlPipe],
  template: `
    <div class="max-w-5xl mx-auto px-4 py-8">
      <app-page-header title="Membres" [subtitle]="members().length + ' compte(s) · ' + adminCount() + ' administrateur(s)'" [icon]="membersIcon">
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nouveau membre
        </button>
      </app-page-header>

      <div class="card overflow-hidden">
        @if (members().length === 0) {
          <div class="p-12 text-center">
            <span class="icon-badge mx-auto mb-4" [innerHTML]="membersIcon | safeHtml"></span>
            <p class="text-ink font-medium">Aucun membre</p>
          </div>
        } @else {
          <table class="w-full">
            <thead>
              <tr class="border-b border-line bg-sunken">
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Utilisateur</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Rôle</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Projets</th>
                <th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (member of members(); track member._id) {
                <tr class="table-row">
                  <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                      <span class="avatar-initials">{{ initials(member.username) }}</span>
                      <p class="text-sm font-medium text-ink">{{ member.username }}</p>
                    </div>
                  </td>
                  <td class="px-5 py-3.5">
                    <span class="chip" [class.chip-brand]="member.isAdmin" [class.chip-neutral]="!member.isAdmin">
                      {{ member.isAdmin ? 'Administrateur' : 'Utilisateur' }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-sm text-ink-secondary">
                    {{ member.isAdmin ? 'Tous les projets' : projectNames(member) }}
                  </td>
                  <td class="px-5 py-3.5">
                    <div class="flex justify-end gap-1.5">
                      <button type="button" (click)="openEdit(member)" title="Modifier" class="icon-btn">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                      </button>
                      <button type="button" (click)="openDelete(member)" title="Supprimer" class="icon-btn icon-btn-danger">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    <!-- Create / edit -->
    <app-modal [open]="crudOpen()" [title]="editing() ? 'Modifier ' + editing()!.username : 'Nouveau membre'" [hasFooter]="false" (closed)="crudOpen.set(false)">
      <form class="flex flex-col gap-4" (ngSubmit)="submit()">
        <div>
          <label class="label" for="username">Nom d'utilisateur</label>
          <input id="username" name="username" class="field" [(ngModel)]="form.username" [readonly]="!!editing()" required />
        </div>

        @if (formError()) {
          <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
        }

        <label class="flex items-center gap-3">
          <input type="checkbox" name="isAdmin" class="h-4 w-4 rounded border-line" [(ngModel)]="form.isAdmin" />
          <span class="text-sm text-ink">Administrateur (accès à tous les projets)</span>
        </label>

        @if (!form.isAdmin) {
          <div>
            <span class="label">Projets accessibles</span>
            <div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              @for (project of projects(); track project._id) {
                <label class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-hover">
                  <input type="checkbox" class="h-4 w-4 rounded border-line" [checked]="form.projects.includes(project._id)" (change)="toggleProject(project._id)" />
                  <span class="text-sm text-ink">{{ project.nom }}</span>
                </label>
              }
              @if (projects().length === 0) {
                <p class="px-2 py-3 text-sm text-ink-muted">Aucun projet disponible.</p>
              }
            </div>
          </div>
        }

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="crudOpen.set(false)">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </app-modal>

    <!-- One-time credentials -->
    <app-modal [open]="!!temporaryPassword()" title="Compte créé" size="sm" (closed)="temporaryPassword.set(null)">
      <p class="text-sm text-ink-secondary">
        Communiquez ce mot de passe temporaire à <strong class="text-ink">{{ createdUsername() }}</strong>. Il ne sera plus affiché ensuite.
      </p>
      <div class="mt-4 rounded-lg bg-sunken p-4">
        <p class="label mb-1">Mot de passe temporaire</p>
        <p class="break-all font-mono text-sm font-semibold text-ink">{{ temporaryPassword() }}</p>
      </div>
      <ng-container modalFooter>
        <button type="button" class="btn btn-primary" (click)="temporaryPassword.set(null)">Compris</button>
      </ng-container>
    </app-modal>

    <!-- Delete confirmation -->
    <app-modal [open]="!!deleting()" title="Supprimer ce membre ?" size="sm" (closed)="deleting.set(null)">
      <p class="text-sm text-ink-secondary">
        Confirmez la suppression de <strong class="text-ink">{{ deleting()?.username }}</strong>. Cette action est irréversible.
      </p>
      <ng-container modalFooter>
        <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">Annuler</button>
        <button type="button" class="btn btn-danger" (click)="confirmDelete()">Supprimer</button>
      </ng-container>
    </app-modal>
  `,
  styles: [
    `
      .avatar-initials {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        background-color: var(--brand-soft);
        color: var(--brand-ink);
        font-size: 0.7rem;
        font-weight: 700;
        flex: none;
      }
      .icon-btn {
        display: flex;
        height: 2rem;
        width: 2rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        border: 1px solid var(--line);
        color: var(--ink-muted);
        transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
      }
      .icon-btn:hover {
        background-color: var(--surface-hover);
        color: var(--brand-ink);
      }
      .icon-btn-danger:hover {
        border-color: var(--crit);
        color: var(--crit);
        background-color: transparent;
      }
    `,
  ],
})
export class MembersComponent implements OnInit {
  private memberService = inject(MemberService);
  private projectService = inject(ProjectService);

  membersIcon = MEMBERS_ICON;
  members = signal<Member[]>([]);
  projects = signal<Project[]>([]);

  crudOpen = signal(false);
  editing = signal<Member | null>(null);
  deleting = signal<Member | null>(null);
  temporaryPassword = signal<string | null>(null);
  createdUsername = signal('');
  formError = signal<string | null>(null);

  form: FormState = { username: '', isAdmin: false, projects: [] };

  ngOnInit(): void {
    this.load();
    this.projectService.getAll().subscribe((projects) => this.projects.set(projects));
  }

  load(): void {
    this.memberService.getAll().subscribe((members) => this.members.set(members));
  }

  adminCount(): number {
    return this.members().filter((m) => m.isAdmin).length;
  }

  initials(username: string): string {
    return username.slice(0, 2).toUpperCase();
  }

  projectNames(member: Member): string {
    return member.projects.map((p) => p.nom).join(', ') || 'Aucun projet';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { username: '', isAdmin: false, projects: [] };
    this.formError.set(null);
    this.crudOpen.set(true);
  }

  openEdit(member: Member): void {
    this.editing.set(member);
    this.form = {
      username: member.username,
      isAdmin: member.isAdmin,
      projects: member.projects.map((p) => p._id),
    };
    this.formError.set(null);
    this.crudOpen.set(true);
  }

  toggleProject(id: string): void {
    const set = new Set(this.form.projects);
    set.has(id) ? set.delete(id) : set.add(id);
    this.form.projects = Array.from(set);
  }

  submit(): void {
    if (!this.form.username.trim()) return;
    this.formError.set(null);

    const editing = this.editing();
    if (editing) {
      this.memberService
        .update(editing._id, { isAdmin: this.form.isAdmin, projects: this.form.projects })
        .subscribe({
          next: () => {
            this.crudOpen.set(false);
            this.load();
          },
          error: (err) => this.formError.set(err?.error?.error || 'Échec de la mise à jour'),
        });
    } else {
      this.memberService.add({ ...this.form }).subscribe({
        next: (res) => {
          this.crudOpen.set(false);
          this.createdUsername.set(res.member.username);
          this.temporaryPassword.set(res.temporaryPassword);
          this.load();
        },
        error: (err) => this.formError.set(err?.error?.error || 'Échec de la création'),
      });
    }
  }

  openDelete(member: Member): void {
    this.deleting.set(member);
  }

  confirmDelete(): void {
    const member = this.deleting();
    if (!member) return;
    this.memberService.delete(member._id).subscribe(() => {
      this.deleting.set(null);
      this.load();
    });
  }
}
