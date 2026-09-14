import { Component } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <footer class="border-t border-line mt-12">
      <div class="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-ink-muted">
        © {{ year }} Orange Traffic · Supervision NTCIP/SNMP · {{ 'common.designedBy' | t }}
        <span class="font-semibold text-ink-secondary">Younès Berayeteb</span>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
