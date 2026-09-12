import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Accessible dialog used for every create/edit/confirm flow in the admin
 * screens, so those flows share one focus-trap-free but keyboard-dismissible
 * (Escape) implementation instead of five bespoke ones.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" [attr.aria-label]="title">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="dismiss()"></div>

        <div class="relative w-full overflow-hidden rounded-2xl border border-line bg-surface" [class]="widthClass" style="box-shadow: var(--shadow-pop)">
          <header class="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 class="text-lg font-semibold text-ink">{{ title }}</h2>
            <button type="button" (click)="dismiss()" aria-label="Fermer" class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="max-h-[70vh] overflow-y-auto px-6 py-5">
            <ng-content></ng-content>
          </div>

          @if (hasFooter) {
            <footer class="flex justify-end gap-2 border-t border-line bg-sunken px-6 py-4">
              <ng-content select="[modalFooter]"></ng-content>
            </footer>
          }
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() hasFooter = true;
  @Output() closed = new EventEmitter<void>();

  get widthClass(): string {
    return { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[this.size];
  }

  dismiss(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.dismiss();
  }
}
