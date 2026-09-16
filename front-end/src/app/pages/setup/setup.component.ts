import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppDatePipe } from '../../core/app-date.pipe';
import { AuthService } from '../../core/services/auth.service';
import { LicenceService } from '../../core/services/licence.service';
import { MemberService } from '../../core/services/member.service';
import { SettingsService } from '../../core/services/settings.service';
import { SetupService } from '../../core/services/setup.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { LicenceStatus } from '../../models/licence';
import { BrandLogoComponent } from '../../ui/brand-logo.component';
import { LanguageToggleComponent } from '../../ui/language-toggle.component';

type Step = 'welcome' | 'admin' | 'licence' | 'smtp' | 'notifications' | 'finish';

type AdminForm = { username: string; password: string; confirmPassword: string };
type SmtpForm = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
  testEmail: string;
};
type NotifForm = { email: string; notifyOnCritical: boolean };

const STEPS: Step[] = ['welcome', 'admin', 'licence', 'smtp', 'notifications', 'finish'];

/**
 * First-run configuration wizard — welcome, admin account, demo license
 * (activated automatically, not skippable, unlike SMTP), SMTP (optional),
 * notification preference for the account just created, finish. One
 * component with an internal step signal rather than sub-routes: the flow is
 * strictly linear and short enough that router-level steps would only add
 * ceremony (see `pages/setup/setup.component.ts` in the plan).
 */
@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandLogoComponent, LanguageToggleComponent, TranslatePipe, AppDatePipe],
  template: `
    <div class="setup-shell">
      <div class="setup-card card">
        <div class="mb-6 flex items-center justify-between">
          <app-brand-logo size="md" variant="partnership" />
          <div class="flex items-center gap-3">
            <app-language-toggle />
            <span class="text-xs text-ink-muted">{{ 'setup.step' | t }} {{ stepIndex() + 1 }} / {{ steps.length }}</span>
          </div>
        </div>

        @switch (step()) {
          @case ('welcome') {
            <h1 class="text-xl font-bold text-ink">{{ 'setup.welcomeTitle' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.welcomeBody' | t }}</p>
            <div class="mt-6 flex justify-end">
              <button type="button" class="btn btn-primary" (click)="goTo('admin')">{{ 'setup.start' | t }}</button>
            </div>
          }

          @case ('admin') {
            <h1 class="text-xl font-bold text-ink">{{ 'setup.adminTitle' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.adminBody' | t }}</p>
            <form class="mt-6 flex flex-col gap-4" (ngSubmit)="createAdmin()">
              <div>
                <label class="label" for="username">{{ 'users.username' | t }}</label>
                <input id="username" name="username" class="field" [(ngModel)]="adminForm.username" required autocomplete="username" />
              </div>
              <div>
                <label class="label" for="password">{{ 'login.password' | t }}</label>
                <input id="password" name="password" type="password" class="field" [(ngModel)]="adminForm.password" required autocomplete="new-password" />
              </div>
              <div>
                <label class="label" for="confirmPassword">{{ 'changePassword.confirmPassword' | t }}</label>
                <input id="confirmPassword" name="confirmPassword" type="password" class="field" [(ngModel)]="adminForm.confirmPassword" required autocomplete="new-password" />
              </div>
              @if (formError()) {
                <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
              }
              <div class="flex justify-end">
                <button type="submit" class="btn btn-primary" [disabled]="busy()">
                  {{ (busy() ? 'setup.creating' : 'setup.createAccount') | t }}
                </button>
              </div>
            </form>
          }

          @case ('licence') {
            <h1 class="text-xl font-bold text-ink">{{ 'nav.license' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.licenceBody' | t }}</p>
            @if (busy()) {
              <p class="mt-6 text-sm text-ink-muted">{{ 'setup.activating' | t }}</p>
            } @else {
              @if (licence(); as l) {
                <div class="mt-6 rounded-lg bg-sunken p-4 text-sm">
                  <p class="flex justify-between py-1"><span class="text-ink-muted">{{ 'nav.license' | t }}</span><span class="font-semibold text-ink">{{ 'license.demo' | t }}</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">{{ 'license.status' | t }}</span><span class="chip chip-good"><span class="chip-dot"></span>{{ 'license.active' | t }}</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">{{ 'license.expiresOn' | t }}</span><span class="font-semibold text-ink">{{ l.expiresAt | appDate: 'date' }}</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">{{ 'license.daysRemaining' | t }}</span><span class="font-semibold text-ink">{{ l.daysRemaining }}</span></p>
                </div>
                <div class="mt-6 flex justify-end">
                  <button type="button" class="btn btn-primary" (click)="goTo('smtp')">{{ 'common.continue' | t }}</button>
                </div>
              } @else if (formError()) {
                <p class="mt-6 chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
                <div class="mt-6 flex justify-end">
                  <button type="button" class="btn btn-primary" (click)="activateLicence()">{{ 'common.retry' | t }}</button>
                </div>
              }
            }
          }

          @case ('smtp') {
            <h1 class="text-xl font-bold text-ink">{{ 'settings.smtpTitle' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.smtpBody' | t }}</p>

            @if (smtpMode() === 'ask') {
              <div class="mt-6 flex flex-col gap-3">
                <button type="button" class="btn btn-primary" (click)="smtpMode.set('form')">{{ 'setup.configureSmtp' | t }}</button>
                <button type="button" class="btn btn-ghost" (click)="goTo('notifications')">{{ 'setup.skipForNow' | t }}</button>
              </div>
            } @else {
              <form class="mt-6 flex flex-col gap-4" (ngSubmit)="saveSmtp()">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="label" for="smtpHost">{{ 'settings.smtpHost' | t }}</label>
                    <input id="smtpHost" name="smtpHost" class="field" [(ngModel)]="smtpForm.smtpHost" [placeholder]="'common.smtpHostPlaceholder' | t" />
                  </div>
                  <div>
                    <label class="label" for="smtpPort">{{ 'settings.smtpPort' | t }}</label>
                    <input id="smtpPort" name="smtpPort" type="number" class="field" [(ngModel)]="smtpForm.smtpPort" />
                  </div>
                  <div>
                    <label class="label" for="smtpUser">{{ 'settings.smtpUser' | t }}</label>
                    <input id="smtpUser" name="smtpUser" class="field" [(ngModel)]="smtpForm.smtpUser" />
                  </div>
                  <div>
                    <label class="label" for="smtpPass">{{ 'login.password' | t }}</label>
                    <input id="smtpPass" name="smtpPass" type="password" class="field" [(ngModel)]="smtpForm.smtpPass" autocomplete="new-password" />
                  </div>
                  <div>
                    <label class="label" for="smtpFromName">{{ 'settings.smtpFromName' | t }}</label>
                    <input id="smtpFromName" name="smtpFromName" class="field" [(ngModel)]="smtpForm.smtpFromName" />
                  </div>
                  <div>
                    <label class="label" for="smtpFromEmail">{{ 'settings.smtpFromEmail' | t }}</label>
                    <input id="smtpFromEmail" name="smtpFromEmail" type="email" class="field" [(ngModel)]="smtpForm.smtpFromEmail" />
                  </div>
                </div>

                <label class="flex items-center gap-3">
                  <input type="checkbox" name="smtpSecure" class="h-4 w-4 rounded border-line" [(ngModel)]="smtpForm.smtpSecure" />
                  <span class="text-sm text-ink">{{ 'settings.smtpSecure' | t }}</span>
                </label>

                <div class="flex items-end gap-3">
                  <div class="flex-1">
                    <label class="label" for="testEmail">{{ 'settings.testAddress' | t }}</label>
                    <input id="testEmail" name="testEmail" type="email" class="field" [(ngModel)]="smtpForm.testEmail" [placeholder]="'common.yourEmailPlaceholder' | t" />
                  </div>
                  <button type="button" class="btn btn-ghost" (click)="testSmtp()" [disabled]="busy()">
                    {{ (busy() ? 'setup.testing' : 'settings.testSmtp') | t }}
                  </button>
                </div>

                @if (testResult(); as t) {
                  <p class="chip self-start" [class.chip-good]="t.ok" [class.chip-crit]="!t.ok">
                    <span class="chip-dot"></span>{{ t.message }}
                  </p>
                }
                @if (formError()) {
                  <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
                }

                <div class="flex justify-between pt-2">
                  <button type="button" class="btn btn-ghost" (click)="goTo('notifications')">{{ 'setup.skipForNow' | t }}</button>
                  <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'setup.saveAndContinue' | t }}</button>
                </div>
              </form>
            }
          }

          @case ('notifications') {
            <h1 class="text-xl font-bold text-ink">{{ 'nav.notifications' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.notificationsBody' | t }}</p>
            <form class="mt-6 flex flex-col gap-4" (ngSubmit)="saveNotifications()">
              <div>
                <label class="label" for="notifEmail">{{ 'users.email' | t }}</label>
                <input id="notifEmail" name="notifEmail" type="email" class="field" [(ngModel)]="notifForm.email" [placeholder]="'common.yourEmailPlaceholder' | t" />
              </div>
              <label class="flex items-center gap-3">
                <input type="checkbox" name="notifyOnCritical" class="h-4 w-4 rounded border-line" [(ngModel)]="notifForm.notifyOnCritical" [disabled]="!notifForm.email.trim()" />
                <span class="text-sm text-ink">{{ 'users.receiveCriticalAlerts' | t }}</span>
              </label>
              @if (formError()) {
                <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
              }
              <div class="flex justify-between pt-2">
                <button type="button" class="btn btn-ghost" (click)="goTo('finish')">{{ 'setup.later' | t }}</button>
                <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'common.continue' | t }}</button>
              </div>
            </form>
          }

          @case ('finish') {
            <h1 class="text-xl font-bold text-ink">{{ 'setup.finishTitle' | t }}</h1>
            <p class="mt-2 text-sm text-ink-secondary">{{ 'setup.finishBody' | t }}</p>
            <div class="mt-6 flex justify-end">
              <button type="button" class="btn btn-primary" (click)="finish()">{{ 'setup.goToApp' | t }}</button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .setup-shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        background-color: var(--surface-sunken, var(--surface));
      }
      .setup-card {
        width: 100%;
        max-width: 32rem;
        padding: 2rem;
      }
    `,
  ],
})
export class SetupComponent {
  private setupService = inject(SetupService);
  private licenceService = inject(LicenceService);
  private settingsService = inject(SettingsService);
  private memberService = inject(MemberService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  steps = STEPS;
  step = signal<Step>('welcome');
  busy = signal(false);
  formError = signal<string | null>(null);

  adminForm: AdminForm = { username: '', password: '', confirmPassword: '' };
  smtpForm: SmtpForm = {
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: 'Orange Traffic',
    smtpFromEmail: '',
    testEmail: '',
  };
  notifForm: NotifForm = { email: '', notifyOnCritical: false };

  smtpMode = signal<'ask' | 'form'>('ask');
  licence = signal<LicenceStatus | null>(null);
  testResult = signal<{ ok: boolean; message: string } | null>(null);

  private memberId = '';

  stepIndex(): number {
    return this.steps.indexOf(this.step());
  }

  goTo(step: Step): void {
    this.formError.set(null);
    this.step.set(step);
    if (step === 'licence') this.activateLicence();
  }

  private apiError(err: any, fallbackKey: string): string {
    return translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t(fallbackKey as any);
  }

  async createAdmin(): Promise<void> {
    if (this.adminForm.password !== this.adminForm.confirmPassword) {
      this.formError.set(this.i18n.t('changePassword.mismatchError'));
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      const res = await this.setupService.createAdmin(
        this.adminForm.username,
        this.adminForm.password,
        this.adminForm.confirmPassword
      );
      this.memberId = res.memberId;
      this.auth.setSession(res.token, res.isAdmin, res.memberId, res.mustChangePassword);
      this.goTo('licence');
    } catch (err: any) {
      this.formError.set(this.apiError(err, 'setup.createAccountFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  async activateLicence(): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      const res = await this.licenceService.activateDemo();
      this.licence.set(res.licence);
    } catch (err: any) {
      this.formError.set(this.apiError(err, 'setup.licenceActivationFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  async testSmtp(): Promise<void> {
    this.busy.set(true);
    this.testResult.set(null);
    try {
      const res = await this.settingsService.testMail({ ...this.smtpForm, to: this.smtpForm.testEmail });
      this.testResult.set(res);
    } catch (err: any) {
      const message = translateApiError(err?.error?.message || err?.error?.error, this.i18n.lang()) || this.i18n.t('setup.testFailed');
      this.testResult.set({ ok: false, stage: 'connexion', message } as any);
    } finally {
      this.busy.set(false);
    }
  }

  async saveSmtp(): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      const { testEmail, ...settings } = this.smtpForm;
      await this.settingsService.update(settings);
      this.goTo('notifications');
    } catch (err: any) {
      this.formError.set(this.apiError(err, 'setup.smtpSaveFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  async saveNotifications(): Promise<void> {
    if (this.notifForm.notifyOnCritical && !this.notifForm.email.trim()) {
      this.formError.set(this.i18n.t('users.emailRequiredError'));
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      await this.memberService.update(this.memberId, {
        email: this.notifForm.email.trim(),
        notifyOnCritical: this.notifForm.notifyOnCritical,
      });
      this.goTo('finish');
    } catch (err: any) {
      this.formError.set(this.apiError(err, 'setup.saveFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  finish(): void {
    this.router.navigateByUrl('/projects');
  }
}
