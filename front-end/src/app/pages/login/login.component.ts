import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { translateApiError } from '../../i18n/backend-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { BrandLogoComponent } from '../../ui/brand-logo.component';
import { LanguageToggleComponent } from '../../ui/language-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandLogoComponent, LanguageToggleComponent, TranslatePipe],
  template: `
    <div class="relative flex min-h-screen bg-app">
      <!-- Imagery panel. Decorative — hidden from assistive tech, collapses
           on small screens rather than stacking below the form. -->
      <div class="relative hidden flex-1 overflow-hidden lg:block" aria-hidden="true">
        @for (image of images; track image; let i = $index) {
          <div class="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out" [class.opacity-100]="i === currentImage()" [class.opacity-0]="i !== currentImage()">
            <img [src]="image" alt="" class="h-full w-full object-cover" />
          </div>
        }

        <div class="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/45 to-black/10"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60"></div>

        <div class="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <app-brand-logo size="lg" variant="partnership" />

          <div class="max-w-lg">
            <span class="chip chip-good mb-6">
              <span class="chip-dot live-dot"></span>
              {{ 'login.liveBadge' | t }}
            </span>
            <h1 class="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {{ 'login.heroTitleLine1' | t }}<br />{{ 'login.heroTitleLine2' | t }}
            </h1>
            <p class="mt-5 text-lg font-light text-white/75">
              {{ 'login.heroBody' | t }}
            </p>
          </div>

          <div class="flex items-center gap-8 text-sm text-white/55">
            <div><span class="block text-2xl font-bold text-white">SNMP</span>NTCIP 1202</div>
            <div><span class="block text-2xl font-bold text-white">24/7</span>{{ 'login.continuousMonitoring' | t }}</div>
            <div><span class="block text-2xl font-bold text-white">ATC-1500</span>Oriux</div>
          </div>
        </div>
      </div>

      <!-- Form panel -->
      <div class="flex w-full items-center justify-center p-6 sm:p-10 lg:w-[28rem] lg:flex-none">
        <div class="w-full max-w-sm">
          <div class="mb-6 flex items-center justify-between lg:hidden">
            <app-brand-logo size="lg" variant="partnership" />
          </div>
          <div class="mb-4 flex justify-end">
            <app-language-toggle />
          </div>

          <h2 class="text-2xl font-bold tracking-tight text-ink">{{ 'login.title' | t }}</h2>
          <p class="mt-1.5 text-sm text-ink-secondary">{{ 'login.subtitle' | t }}</p>

          <form class="mt-8 flex flex-col gap-5" (ngSubmit)="submit()">
            <div>
              <label class="label" for="username">{{ 'login.username' | t }}</label>
              <input id="username" name="username" class="field" [(ngModel)]="username" autocomplete="username" required />
            </div>

            <div>
              <label class="label" for="password">{{ 'login.password' | t }}</label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  class="field pr-11"
                  [(ngModel)]="password"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition hover:text-ink"
                  [attr.aria-label]="(showPassword() ? 'login.hidePassword' : 'login.showPassword') | t"
                >
                  @if (!showPassword()) {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1 1 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  } @else {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.48 10.48 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.5a10.52 10.52 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243" />
                    </svg>
                  }
                </button>
              </div>
            </div>

            @if (error()) {
              <p class="chip chip-crit self-start"><span class="chip-dot"></span>{{ error() }}</p>
            }

            <button type="submit" class="btn btn-primary w-full py-3" [disabled]="loading()">
              {{ loading() ? ('common.loading' | t) : ('login.submit' | t) }}
            </button>
          </form>

          <p class="mt-10 text-center text-xs text-ink-muted">
            Orange Traffic · Supervision NTCIP/SNMP
            <br />
            {{ 'common.designedBy' | t }} <span class="font-semibold text-ink-secondary">Younès Berayeteb</span>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  readonly images = ['assets/login/bg-highway.webp', 'assets/login/bg-office.webp'];
  currentImage = signal(0);

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  private carousel?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.carousel = setInterval(() => {
      this.currentImage.set((this.currentImage() + 1) % this.images.length);
    }, 6000);
  }

  ngOnDestroy(): void {
    clearInterval(this.carousel);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.username, this.password);
      this.router.navigateByUrl('/projects');
    } catch (err: any) {
      this.error.set(translateApiError(err?.error?.error, this.i18n.lang()) || this.i18n.t('login.failed'));
    } finally {
      this.loading.set(false);
    }
  }
}
