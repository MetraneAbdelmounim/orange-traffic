import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { LicenceService } from '../../core/services/licence.service';
import { LicenceStatus } from '../../models/licence';
import { PageHeaderComponent } from '../../ui/page-header.component';

const LICENSE_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>`;

/**
 * Full management view for admins (activate a demo license, upload a real
 * one) and a reduced read-only view for everyone else — the same route a 402
 * license error redirects any signed-in user to, so a non-admin needs to see
 * *something* useful here, just not the controls they can't use.
 */
@Component({
  selector: 'app-license',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <app-page-header title="Licence" subtitle="Gestion de la licence Orange Traffic" [icon]="licenseIcon" />

      @if (loading()) {
        <div class="card h-40 skeleton"></div>
      } @else {
        <div class="card p-6">
          @if (status(); as s) {
            @if (s.installed) {
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-lg font-semibold text-ink">{{ s.type === 'demo' ? 'Licence démo' : s.customer }}</p>
                  <p class="text-sm text-ink-muted">{{ s.licenceId }}</p>
                </div>
                @if (s.valid) {
                  <span class="chip chip-good"><span class="chip-dot"></span>Active</span>
                } @else {
                  <span class="chip chip-crit"><span class="chip-dot"></span>Expirée</span>
                }
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-xs text-ink-muted">Expire le</p>
                  <p class="font-medium text-ink">{{ s.expiresAt | date: 'dd/MM/yyyy' }}</p>
                </div>
                <div>
                  <p class="text-xs text-ink-muted">Jours restants</p>
                  <p class="font-medium text-ink">{{ s.valid ? s.daysRemaining : 0 }}</p>
                </div>
                @if (s.maxControllers) {
                  <div>
                    <p class="text-xs text-ink-muted">Contrôleurs max.</p>
                    <p class="font-medium text-ink">{{ s.maxControllers }}</p>
                  </div>
                }
              </div>
            } @else {
              <p class="chip chip-crit self-start"><span class="chip-dot"></span>Aucune licence installée</p>
            }
          }
        </div>

        @if (auth.isAdmin()) {
          <div class="card p-6 mt-6">
            @if (!status()?.valid) {
              <button type="button" class="btn btn-primary" (click)="activateDemo()" [disabled]="busy()">
                {{ busy() ? 'Activation…' : 'Activer une licence démo (10 jours)' }}
              </button>
            }

            <div class="mt-6">
              <p class="label mb-2">Téléverser une licence (.otlic)</p>
              <div
                class="drop-zone"
                [class.drop-zone-active]="dragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="dragging.set(false)"
                (drop)="onDrop($event)"
              >
                <p class="text-sm text-ink-secondary">Glissez-déposez un fichier .otlic ici, ou</p>
                <label class="btn btn-ghost mt-2 cursor-pointer">
                  Choisir un fichier
                  <input type="file" accept=".otlic,application/json" class="hidden" (change)="onFileSelected($event)" />
                </label>
                @if (selectedFile()) {
                  <p class="mt-2 text-xs text-ink-muted">{{ selectedFile()!.name }}</p>
                }
              </div>
              <div class="mt-3 flex justify-end">
                <button type="button" class="btn btn-primary" [disabled]="!selectedFile() || busy()" (click)="upload()">
                  {{ busy() ? 'Envoi…' : 'Téléverser la licence' }}
                </button>
              </div>
            </div>

            @if (message(); as m) {
              <p class="mt-4 chip self-start" [class.chip-good]="m.ok" [class.chip-crit]="!m.ok">
                <span class="chip-dot"></span>{{ m.text }}
              </p>
            }
          </div>
        } @else {
          <div class="card p-6 mt-6 text-center">
            <p class="text-sm text-ink-secondary">Contactez votre administrateur pour renouveler la licence.</p>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .drop-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        border: 2px dashed var(--line);
        border-radius: 0.75rem;
        padding: 1.5rem;
        text-align: center;
        transition: border-color 140ms ease, background-color 140ms ease;
      }
      .drop-zone-active {
        border-color: var(--brand);
        background-color: var(--brand-soft);
      }
    `,
  ],
})
export class LicenseComponent implements OnInit {
  private licenceService = inject(LicenceService);
  auth = inject(AuthService);

  licenseIcon = LICENSE_ICON;
  loading = signal(true);
  busy = signal(false);
  dragging = signal(false);
  status = signal<LicenceStatus | null>(null);
  selectedFile = signal<File | null>(null);
  message = signal<{ ok: boolean; text: string } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.status.set(await this.licenceService.status());
    } finally {
      this.loading.set(false);
    }
  }

  async activateDemo(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      const res = await this.licenceService.activateDemo();
      this.status.set(res.licence);
      this.message.set({ ok: true, text: res.message });
    } catch (err: any) {
      this.message.set({ ok: false, text: err?.error?.error || "Échec de l'activation" });
    } finally {
      this.busy.set(false);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.selectedFile.set(file);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.selectedFile.set(file);
  }

  async upload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const res = await this.licenceService.upload(file);
      this.status.set(res.licence);
      this.selectedFile.set(null);
      this.message.set({ ok: true, text: `✓ ${res.message}` });
    } catch (err: any) {
      this.message.set({ ok: false, text: `✕ ${err?.error?.error || 'Licence invalide'}` });
    } finally {
      this.busy.set(false);
    }
  }
}
