import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LicenceService } from '../../core/services/licence.service';
import { MemberService } from '../../core/services/member.service';
import { SettingsService } from '../../core/services/settings.service';
import { SetupService } from '../../core/services/setup.service';
import { LicenceStatus } from '../../models/licence';
import { BrandLogoComponent } from '../../ui/brand-logo.component';

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
  imports: [CommonModule, FormsModule, BrandLogoComponent],
  template: `
    <div class="setup-shell">
      <div class="setup-card card">
        <div class="mb-6 flex items-center justify-between">
          <app-brand-logo size="md" variant="partnership" />
          <span class="text-xs text-ink-muted">Étape {{ stepIndex() + 1 }} / {{ steps.length }}</span>
        </div>

        @switch (step()) {
          @case ('welcome') {
            <h1 class="text-xl font-bold text-ink">Bienvenue sur Orange Traffic</h1>
            <p class="mt-2 text-sm text-ink-secondary">
              Cette application n'est pas encore configurée. Ce court assistant va créer votre compte
              administrateur, activer une licence d'essai et, si vous le souhaitez, configurer les
              notifications par e-mail.
            </p>
            <div class="mt-6 flex justify-end">
              <button type="button" class="btn btn-primary" (click)="goTo('admin')">Commencer</button>
            </div>
          }

          @case ('admin') {
            <h1 class="text-xl font-bold text-ink">Compte administrateur</h1>
            <p class="mt-2 text-sm text-ink-secondary">Ce compte aura tous les droits sur l'application.</p>
            <form class="mt-6 flex flex-col gap-4" (ngSubmit)="createAdmin()">
              <div>
                <label class="label" for="username">Nom d'utilisateur</label>
                <input id="username" name="username" class="field" [(ngModel)]="adminForm.username" required autocomplete="username" />
              </div>
              <div>
                <label class="label" for="password">Mot de passe</label>
                <input id="password" name="password" type="password" class="field" [(ngModel)]="adminForm.password" required autocomplete="new-password" />
              </div>
              <div>
                <label class="label" for="confirmPassword">Confirmer le mot de passe</label>
                <input id="confirmPassword" name="confirmPassword" type="password" class="field" [(ngModel)]="adminForm.confirmPassword" required autocomplete="new-password" />
              </div>
              @if (formError()) {
                <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
              }
              <div class="flex justify-end">
                <button type="submit" class="btn btn-primary" [disabled]="busy()">
                  {{ busy() ? 'Création…' : 'Créer le compte' }}
                </button>
              </div>
            </form>
          }

          @case ('licence') {
            <h1 class="text-xl font-bold text-ink">Licence</h1>
            <p class="mt-2 text-sm text-ink-secondary">Activation d'une licence d'essai de 10 jours.</p>
            @if (busy()) {
              <p class="mt-6 text-sm text-ink-muted">Activation en cours…</p>
            } @else {
              @if (licence(); as l) {
                <div class="mt-6 rounded-lg bg-sunken p-4 text-sm">
                  <p class="flex justify-between py-1"><span class="text-ink-muted">Licence</span><span class="font-semibold text-ink">Démo</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">Statut</span><span class="chip chip-good"><span class="chip-dot"></span>Active</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">Expire le</span><span class="font-semibold text-ink">{{ l.expiresAt | date: 'dd/MM/yyyy' }}</span></p>
                  <p class="flex justify-between py-1"><span class="text-ink-muted">Jours restants</span><span class="font-semibold text-ink">{{ l.daysRemaining }}</span></p>
                </div>
                <div class="mt-6 flex justify-end">
                  <button type="button" class="btn btn-primary" (click)="goTo('smtp')">Continuer</button>
                </div>
              } @else if (formError()) {
                <p class="mt-6 chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
                <div class="mt-6 flex justify-end">
                  <button type="button" class="btn btn-primary" (click)="activateLicence()">Réessayer</button>
                </div>
              }
            }
          }

          @case ('smtp') {
            <h1 class="text-xl font-bold text-ink">Configuration SMTP</h1>
            <p class="mt-2 text-sm text-ink-secondary">Configurer l'envoi d'e-mails maintenant ?</p>

            @if (smtpMode() === 'ask') {
              <div class="mt-6 flex flex-col gap-3">
                <button type="button" class="btn btn-primary" (click)="smtpMode.set('form')">Configurer SMTP</button>
                <button type="button" class="btn btn-ghost" (click)="goTo('notifications')">Passer pour l'instant</button>
              </div>
            } @else {
              <form class="mt-6 flex flex-col gap-4" (ngSubmit)="saveSmtp()">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="label" for="smtpHost">Hôte SMTP</label>
                    <input id="smtpHost" name="smtpHost" class="field" [(ngModel)]="smtpForm.smtpHost" placeholder="smtp.exemple.com" />
                  </div>
                  <div>
                    <label class="label" for="smtpPort">Port</label>
                    <input id="smtpPort" name="smtpPort" type="number" class="field" [(ngModel)]="smtpForm.smtpPort" />
                  </div>
                  <div>
                    <label class="label" for="smtpUser">Utilisateur</label>
                    <input id="smtpUser" name="smtpUser" class="field" [(ngModel)]="smtpForm.smtpUser" />
                  </div>
                  <div>
                    <label class="label" for="smtpPass">Mot de passe</label>
                    <input id="smtpPass" name="smtpPass" type="password" class="field" [(ngModel)]="smtpForm.smtpPass" autocomplete="new-password" />
                  </div>
                  <div>
                    <label class="label" for="smtpFromName">Nom de l'expéditeur</label>
                    <input id="smtpFromName" name="smtpFromName" class="field" [(ngModel)]="smtpForm.smtpFromName" />
                  </div>
                  <div>
                    <label class="label" for="smtpFromEmail">E-mail de l'expéditeur</label>
                    <input id="smtpFromEmail" name="smtpFromEmail" type="email" class="field" [(ngModel)]="smtpForm.smtpFromEmail" />
                  </div>
                </div>

                <label class="flex items-center gap-3">
                  <input type="checkbox" name="smtpSecure" class="h-4 w-4 rounded border-line" [(ngModel)]="smtpForm.smtpSecure" />
                  <span class="text-sm text-ink">Connexion sécurisée (TLS/SSL)</span>
                </label>

                <div class="flex items-end gap-3">
                  <div class="flex-1">
                    <label class="label" for="testEmail">Adresse de test</label>
                    <input id="testEmail" name="testEmail" type="email" class="field" [(ngModel)]="smtpForm.testEmail" placeholder="vous@exemple.com" />
                  </div>
                  <button type="button" class="btn btn-ghost" (click)="testSmtp()" [disabled]="busy()">
                    {{ busy() ? 'Test…' : 'Tester la connexion' }}
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
                  <button type="button" class="btn btn-ghost" (click)="goTo('notifications')">Passer pour l'instant</button>
                  <button type="submit" class="btn btn-primary" [disabled]="busy()">Enregistrer et continuer</button>
                </div>
              </form>
            }
          }

          @case ('notifications') {
            <h1 class="text-xl font-bold text-ink">Notifications</h1>
            <p class="mt-2 text-sm text-ink-secondary">Recevoir les alertes critiques par e-mail sur ce compte ?</p>
            <form class="mt-6 flex flex-col gap-4" (ngSubmit)="saveNotifications()">
              <div>
                <label class="label" for="notifEmail">E-mail</label>
                <input id="notifEmail" name="notifEmail" type="email" class="field" [(ngModel)]="notifForm.email" placeholder="vous@exemple.com" />
              </div>
              <label class="flex items-center gap-3">
                <input type="checkbox" name="notifyOnCritical" class="h-4 w-4 rounded border-line" [(ngModel)]="notifForm.notifyOnCritical" [disabled]="!notifForm.email.trim()" />
                <span class="text-sm text-ink">Recevoir les alertes critiques par e-mail</span>
              </label>
              @if (formError()) {
                <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ formError() }}</p>
              }
              <div class="flex justify-between pt-2">
                <button type="button" class="btn btn-ghost" (click)="goTo('finish')">Plus tard</button>
                <button type="submit" class="btn btn-primary" [disabled]="busy()">Continuer</button>
              </div>
            </form>
          }

          @case ('finish') {
            <h1 class="text-xl font-bold text-ink">Tout est prêt</h1>
            <p class="mt-2 text-sm text-ink-secondary">
              Votre compte administrateur est créé et votre licence d'essai est active. Vous pouvez
              modifier ces réglages à tout moment depuis la page Réglages.
            </p>
            <div class="mt-6 flex justify-end">
              <button type="button" class="btn btn-primary" (click)="finish()">Accéder à l'application</button>
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

  async createAdmin(): Promise<void> {
    if (this.adminForm.password !== this.adminForm.confirmPassword) {
      this.formError.set('Les mots de passe ne correspondent pas');
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
      this.auth.setSession(res.token, res.isAdmin);
      this.goTo('licence');
    } catch (err: any) {
      this.formError.set(err?.error?.error || 'Échec de la création du compte');
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
      this.formError.set(err?.error?.error || "Échec de l'activation de la licence");
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
      this.testResult.set({ ok: false, stage: 'connexion', message: err?.error?.message || err?.error?.error || 'Échec du test' } as any);
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
      this.formError.set(err?.error?.error || "Échec de l'enregistrement SMTP");
    } finally {
      this.busy.set(false);
    }
  }

  async saveNotifications(): Promise<void> {
    if (this.notifForm.notifyOnCritical && !this.notifForm.email.trim()) {
      this.formError.set('Une adresse e-mail est requise pour activer les alertes');
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
      this.formError.set(err?.error?.error || "Échec de l'enregistrement");
    } finally {
      this.busy.set(false);
    }
  }

  finish(): void {
    this.router.navigateByUrl('/projects');
  }
}
