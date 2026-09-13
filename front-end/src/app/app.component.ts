import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { FooterComponent } from './ui/footer.component';
import { HeaderComponent } from './ui/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    @if (showChrome()) {
      <app-header />
    }
    <main>
      <router-outlet />
    </main>
    @if (showChrome()) {
      <app-footer />
    }
  `,
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  // The setup wizard signs the new admin in partway through (so its later
  // steps can call normal authenticated endpoints) — the app chrome must
  // stay hidden for the whole wizard regardless, or its nav links would let
  // someone wander off before onboarding is actually finished.
  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  showChrome = () => this.auth.isAuthenticated() && !this.url().startsWith('/setup');
}
