import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="border-t border-line mt-12">
      <div class="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-ink-muted">
        © {{ year }} Orange Traffic · Supervision NTCIP/SNMP · Conçu par
        <span class="font-semibold text-ink-secondary">Younès Berayeteb</span>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
