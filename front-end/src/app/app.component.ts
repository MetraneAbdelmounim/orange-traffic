import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { FooterComponent } from './ui/footer.component';
import { HeaderComponent } from './ui/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    @if (auth.isAuthenticated()) {
      <app-header />
    }
    <main>
      <router-outlet />
    </main>
    @if (auth.isAuthenticated()) {
      <app-footer />
    }
  `,
})
export class AppComponent {
  auth = inject(AuthService);
}
