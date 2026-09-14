import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LicenceService } from '../../core/services/licence.service';
import { SettingsService } from '../../core/services/settings.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { LicenceStatus } from '../../models/licence';
import { SettingsUpdate } from '../../models/settings';
import { PageHeaderComponent } from '../../ui/page-header.component';

const SETTINGS_ICON = `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe],
  template: `
    <div class="max-w-5xl mx-auto px-4 py-8">
      <app-page-header [title]="'nav.settings' | t" [subtitle]="'settings.subtitle' | t" [icon]="settingsIcon" />

      @if (loading()) {
        <div class="grid gap-6 lg:grid-cols-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card h-48 skeleton"></div>
          }
        </div>
      } @else {
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- General -->
          <section class="card p-6">
            <header class="mb-4">
              <h2 class="text-sm font-semibold text-ink">{{ 'settings.general' | t }}</h2>
              <p class="text-xs text-ink-muted">{{ 'settings.generalHint' | t }}</p>
            </header>
            <div class="flex flex-col gap-4">
              <div>
                <label class="label" for="pollIntervalSeconds">{{ 'settings.pollInterval' | t }}</label>
                <input id="pollIntervalSeconds" type="number" class="field" [(ngModel)]="form.pollIntervalSeconds" name="pollIntervalSeconds" />
              </div>
              <div>
                <label class="label" for="defaultSnmpCommunity">{{ 'settings.defaultSnmpCommunity' | t }}</label>
                <input id="defaultSnmpCommunity" class="field" [(ngModel)]="form.defaultSnmpCommunity" name="defaultSnmpCommunity" />
              </div>
              <div class="flex justify-end">
                <button type="button" class="btn btn-primary" (click)="saveGeneral()" [disabled]="saving()">{{ 'common.save' | t }}</button>
              </div>
            </div>
          </section>

          <!-- SMTP -->
          <section class="card p-6">
            <header class="mb-4">
              <h2 class="text-sm font-semibold text-ink">{{ 'settings.smtpTitle' | t }}</h2>
              <p class="text-xs text-ink-muted">{{ 'settings.smtpHint' | t }}</p>
            </header>
            <div class="flex flex-col gap-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="label" for="smtpHost">{{ 'settings.smtpHost' | t }}</label>
                  <input id="smtpHost" class="field" [(ngModel)]="form.smtpHost" name="smtpHost" />
                </div>
                <div>
                  <label class="label" for="smtpPort">{{ 'settings.smtpPort' | t }}</label>
                  <input id="smtpPort" type="number" class="field" [(ngModel)]="form.smtpPort" name="smtpPort" />
                </div>
                <div>
                  <label class="label" for="smtpUser">{{ 'settings.smtpUser' | t }}</label>
                  <input id="smtpUser" class="field" [(ngModel)]="form.smtpUser" name="smtpUser" />
                </div>
                <div>
                  <label class="label" for="smtpPass">{{ 'login.password' | t }}</label>
                  <input id="smtpPass" type="password" class="field" [(ngModel)]="form.smtpPass" name="smtpPass" [placeholder]="passwordPlaceholder()" autocomplete="new-password" />
                </div>
                <div>
                  <label class="label" for="smtpFromName">{{ 'settings.smtpFromName' | t }}</label>
                  <input id="smtpFromName" class="field" [(ngModel)]="form.smtpFromName" name="smtpFromName" />
                </div>
                <div>
                  <label class="label" for="smtpFromEmail">{{ 'settings.smtpFromEmail' | t }}</label>
                  <input id="smtpFromEmail" type="email" class="field" [(ngModel)]="form.smtpFromEmail" name="smtpFromEmail" />
                </div>
              </div>
              <label class="flex items-center gap-3">
                <input type="checkbox" class="h-4 w-4 rounded border-line" [(ngModel)]="form.smtpSecure" name="smtpSecure" />
                <span class="text-sm text-ink">{{ 'settings.smtpSecure' | t }}</span>
              </label>

              <div class="flex items-end gap-3">
                <div class="flex-1">
                  <label class="label" for="testTo">{{ 'settings.testAddress' | t }}</label>
                  <input id="testTo" type="email" class="field" [(ngModel)]="testTo" name="testTo" [placeholder]="'common.yourEmailPlaceholder' | t" />
                </div>
                <button type="button" class="btn btn-ghost" (click)="testSmtp()" [disabled]="testing()">
                  {{ (testing() ? 'setup.testing' : 'settings.testSmtp') | t }}
                </button>
              </div>
              @if (testResult(); as t) {
                <p class="chip self-start" [class.chip-good]="t.ok" [class.chip-crit]="!t.ok"><span class="chip-dot"></span>{{ t.message }}</p>
              }

              <div class="flex justify-end">
                <button type="button" class="btn btn-primary" (click)="saveSmtp()" [disabled]="saving()">{{ 'common.save' | t }}</button>
              </div>
            </div>
          </section>

          <!-- Notifications -->
          <section class="card p-6">
            <header class="mb-4">
              <h2 class="text-sm font-semibold text-ink">{{ 'nav.notifications' | t }}</h2>
              <p class="text-xs text-ink-muted">{{ 'settings.notificationsHint' | t }}</p>
            </header>
            <p class="text-sm text-ink-secondary">{{ 'settings.notificationsBody' | t }}</p>
            <a routerLink="/admin/members" class="btn btn-ghost mt-4 inline-flex">{{ 'settings.manageMemberPrefs' | t }}</a>
          </section>

          <!-- License -->
          <section class="card p-6">
            <header class="mb-4">
              <h2 class="text-sm font-semibold text-ink">{{ 'nav.license' | t }}</h2>
              <p class="text-xs text-ink-muted">{{ 'settings.licenseHint' | t }}</p>
            </header>
            @if (licence(); as l) {
              @if (l.installed) {
                <div class="flex items-center justify-between">
                  <span class="text-sm text-ink">{{ l.type === 'demo' ? ('license.demo' | t) : l.customer }}</span>
                  @if (l.valid) {
                    <span class="chip chip-good"><span class="chip-dot"></span>{{ l.daysRemaining }} {{ 'settings.daysRemainingShort' | t }}</span>
                  } @else {
                    <span class="chip chip-crit"><span class="chip-dot"></span>{{ 'license.expired' | t }}</span>
                  }
                </div>
              } @else {
                <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ 'license.none' | t }}</p>
              }
            }
            <a routerLink="/admin/license" class="btn btn-ghost mt-4 inline-flex">{{ 'settings.manageLicense' | t }}</a>
          </section>

          <!-- Administration -->
          <section class="card p-6">
            <header class="mb-4">
              <h2 class="text-sm font-semibold text-ink">{{ 'settings.administration' | t }}</h2>
              <p class="text-xs text-ink-muted">{{ 'settings.administrationHint' | t }}</p>
            </header>
            <a routerLink="/admin/members" class="btn btn-ghost inline-flex">{{ 'settings.manageMembers' | t }}</a>
          </section>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private licenceService = inject(LicenceService);
  private i18n = inject(I18nService);

  settingsIcon = SETTINGS_ICON;
  loading = signal(true);
  saving = signal(false);
  testing = signal(false);
  testTo = '';
  testResult = signal<{ ok: boolean; message: string } | null>(null);
  licence = signal<LicenceStatus | null>(null);

  form: SettingsUpdate & { smtpPassSet?: boolean } = {
    pollIntervalSeconds: 60,
    defaultSnmpCommunity: 'public',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: '',
    smtpFromEmail: '',
  };

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [settings, licence] = await Promise.all([this.settingsService.get(), this.licenceService.status()]);
      this.form = { ...settings, smtpPass: '' };
      this.licence.set(licence);
    } finally {
      this.loading.set(false);
    }
  }

  passwordPlaceholder(): string {
    return this.form.smtpPassSet ? this.i18n.t('settings.smtpPassSetPlaceholder') : this.i18n.t('settings.smtpPassUnsetPlaceholder');
  }

  async saveGeneral(): Promise<void> {
    this.saving.set(true);
    try {
      await this.settingsService.update({
        pollIntervalSeconds: this.form.pollIntervalSeconds,
        defaultSnmpCommunity: this.form.defaultSnmpCommunity,
      });
    } finally {
      this.saving.set(false);
    }
  }

  async saveSmtp(): Promise<void> {
    this.saving.set(true);
    try {
      const updated = await this.settingsService.update({
        smtpHost: this.form.smtpHost,
        smtpPort: this.form.smtpPort,
        smtpSecure: this.form.smtpSecure,
        smtpUser: this.form.smtpUser,
        smtpPass: this.form.smtpPass,
        smtpFromName: this.form.smtpFromName,
        smtpFromEmail: this.form.smtpFromEmail,
      });
      this.form = { ...updated, smtpPass: '' };
    } finally {
      this.saving.set(false);
    }
  }

  async testSmtp(): Promise<void> {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const res = await this.settingsService.testMail({
        smtpHost: this.form.smtpHost,
        smtpPort: this.form.smtpPort,
        smtpSecure: this.form.smtpSecure,
        smtpUser: this.form.smtpUser,
        smtpPass: this.form.smtpPass,
        smtpFromName: this.form.smtpFromName,
        smtpFromEmail: this.form.smtpFromEmail,
        to: this.testTo,
      });
      this.testResult.set(res);
    } catch (err: any) {
      const message = translateApiError(err?.error?.message || err?.error?.error, this.i18n.lang()) || this.i18n.t('setup.testFailed');
      this.testResult.set({ ok: false, message });
    } finally {
      this.testing.set(false);
    }
  }
}
