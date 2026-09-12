import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * The Orange Traffic wordmark, always rendered on a fixed white chip.
 *
 * The source asset has a dark "traffic" wordmark with no transparent/dark
 * background variant. Placed directly on a dark header, a dark theme card,
 * or a night photograph, that half of the logo disappears. Every placement
 * goes through this component instead of `<img>` directly, so the fix lives
 * in one place rather than being re-solved (or forgotten) per page.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="brand-logo-chip" [class]="sizeClass">
      <img src="assets/logo-mark.webp" alt="Orange Traffic" />
    </span>
  `,
  styles: [
    `
      .brand-logo-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 0.625rem;
        background-color: #ffffff;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
      }
      .brand-logo-chip img {
        display: block;
        width: auto;
        object-fit: contain;
      }
      .size-sm { padding: 0.3rem 0.55rem; }
      .size-sm img { height: 1.1rem; }
      .size-md { padding: 0.45rem 0.75rem; }
      .size-md img { height: 1.5rem; }
      .size-lg { padding: 0.6rem 1rem; }
      .size-lg img { height: 2.1rem; }
    `,
  ],
})
export class BrandLogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get sizeClass(): string {
    return `size-${this.size}`;
  }
}
