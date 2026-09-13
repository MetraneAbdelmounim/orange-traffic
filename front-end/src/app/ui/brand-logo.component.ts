import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * The Orange Traffic wordmark, always rendered on a fixed white chip — and,
 * in `partnership` mode, paired with the InfraPulse mark to signal that this
 * platform is an Orange Traffic deployment built on InfraPulse.
 *
 * The source Orange Traffic asset has a dark "traffic" wordmark with no
 * transparent/dark background variant. Placed directly on a dark header, a
 * dark theme card, or a night photograph, that half of the logo disappears.
 * Every placement goes through this component instead of an `<img>` directly,
 * so the fix lives in one place rather than being re-solved (or forgotten)
 * per page. Both marks render at `object-fit: contain` with only their
 * height fixed, so neither is ever stretched or cropped.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="brand-logo-chip" [class]="sizeClass">
      <img src="assets/logo-mark.webp" alt="Orange Traffic" class="mark mark-orange" />
      @if (variant === 'partnership') {
        <span class="divider" aria-hidden="true"></span>
        <img src="assets/infrapulse-logo.png" alt="InfraPulse" class="mark mark-infrapulse" />
      }
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
        /* Defense in depth: a source asset with unexpected intrinsic
           proportions (e.g. baked-in padding or a tagline) must never be able
           to blow out past this chip and cover the rest of the page — it did,
           before infrapulse-logo.png was pre-cropped to icon+wordmark only. */
        overflow: hidden;
        max-width: 100%;
      }
      .mark {
        display: block;
        width: auto;
        max-width: 100%;
        object-fit: contain;
      }
      .divider {
        display: block;
        width: 1px;
        align-self: stretch;
        background-color: #e2ded9;
        margin: 0 0.1em;
      }
      /*
       * Explicit rem heights, not a percentage. .brand-logo-chip has no
       * fixed height of its own (it sizes to its content via padding), and a
       * percentage height on a child only resolves against a parent with a
       * determinate height — against an auto-height parent it computes to
       * nothing, so the browser falls back to the image's intrinsic
       * dimensions. That is exactly what blew this badge up to cover the
       * page the first two times this was built: a "72%" that silently did
       * nothing, on an asset whose natural size is enormous.
       */
      /*
       * InfraPulse's asset is a very wide wordmark (natural ratio ~8:1), so
       * matching heights 1:1 with Orange Traffic made it read as the bigger,
       * louder logo of the two even though Orange Traffic is the primary
       * brand and InfraPulse is the "built on" attribution. Its height is
       * deliberately ~half of Orange Traffic's to keep it visually secondary.
       */
      .size-sm { padding: 0.35rem 0.6rem; gap: 0.5rem; }
      .size-sm .mark-orange { height: 1.35rem; }
      .size-sm .mark-infrapulse { height: 0.68rem; }
      .size-md { padding: 0.5rem 0.85rem; gap: 0.6rem; }
      .size-md .mark-orange { height: 1.9rem; }
      .size-md .mark-infrapulse { height: 0.95rem; }
      .size-lg { padding: 0.7rem 1.1rem; gap: 0.75rem; }
      .size-lg .mark-orange { height: 2.6rem; }
      .size-lg .mark-infrapulse { height: 1.3rem; }
    `,
  ],
})
export class BrandLogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() variant: 'solo' | 'partnership' = 'solo';

  get sizeClass(): string {
    return `size-${this.size}`;
  }
}
