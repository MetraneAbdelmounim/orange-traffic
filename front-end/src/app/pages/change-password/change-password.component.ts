import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MemberService } from '../../core/services/member.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { BrandLogoComponent } from '../../ui/brand-logo.component';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Forced (or voluntary) password change. When `auth.mustChangePassword()` is
 * true, `passwordChangeGuard` redirects every other route here — the backend
 * enforces the same restriction independently (`requirePasswordChanged`
 * middleware on every business route), so this page is the UX path out of a
 * state a user cannot otherwise escape by navigating elsewhere or calling
 * the API directly.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandLogoComponent, TranslatePipe],
  template: `
    <div class="shell">
      <div class="card p-8" style="width: 100%; max-width: 28rem;">
        <div class="mb-6 flex justify-center">
          <app-brand-logo size="md" variant="partnership" />
        </div>
        <h1 class="text-xl font-bold text-ink text-center">{{ 'changePassword.title' | t }}</h1>
        <p class="mt-2 text-sm text-ink-secondary text-center">
          {{ (forced() ? 'changePassword.forcedSubtitle' : 'changePassword.subtitle') | t }}
        </p>

        <form class="mt-6 flex flex-col gap-4" (ngSubmit)="submit()">
          <div>
            <label class="label" for="currentPass">{{ 'changePassword.currentPassword' | t }}</label>
            <input id="currentPass" name="currentPass" type="password" class="field" [(ngModel)]="form.currentPass" required autocomplete="current-password" />
          </div>
          <div>
            <label class="label" for="newPass">{{ 'changePassword.newPassword' | t }}</label>
            <input id="newPass" name="newPass" type="password" class="field" [(ngModel)]="form.newPass" required autocomplete="new-password" />
          </div>
          <div>
            <label class="label" for="confirmedPass">{{ 'changePassword.confirmPassword' | t }}</label>
            <input id="confirmedPass" name="confirmedPass" type="password" class="field" [(ngModel)]="form.confirmedPass" required autocomplete="new-password" />
          </div>

          @if (error()) {
            <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ error() }}</p>
          }
          @if (success()) {
            <p class="chip chip-good self-start"><span class="chip-dot"></span>{{ success() }}</p>
          }

          <button type="submit" class="btn btn-primary" [disabled]="busy()">
            {{ (busy() ? 'common.loading' : 'changePassword.submit') | t }}
          </button>
          @if (!forced()) {
            <button type="button" class="btn btn-ghost" (click)="cancel()">{{ 'common.cancel' | t }}</button>
          }
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        background-color: var(--surface-sunken, var(--surface));
      }
    `,
  ],
})
export class ChangePasswordComponent {
  private memberService = inject(MemberService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  form = { currentPass: '', newPass: '', confirmedPass: '' };
  busy = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  forced = () => this.auth.mustChangePassword();

  submit(): void {
    this.error.set(null);
    this.success.set(null);

    if (this.form.newPass !== this.form.confirmedPass) {
      this.error.set(this.i18n.t('changePassword.mismatchError'));
      return;
    }
    if (this.form.newPass.length < MIN_PASSWORD_LENGTH) {
      this.error.set(this.i18n.t('changePassword.tooShortError', { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    const memberId = this.auth.memberId();
    if (!memberId) {
      this.error.set(this.i18n.t('changePassword.invalidSessionError'));
      return;
    }

    this.busy.set(true);
    this.memberService.changePassword(memberId, this.form).subscribe({
      next: () => {
        this.busy.set(false);
        this.auth.clearMustChangePassword();
        this.success.set(this.i18n.t('changePassword.success'));
        this.router.navigateByUrl('/projects');
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(
          translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('changePassword.failure')
        );
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/projects');
  }
}
