import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marks a string as trusted HTML for `[innerHTML]`.
 *
 * Angular's default sanitizer strips `<svg>`/`<path>` — they are not on its
 * built-in allowlist — so an `[innerHTML]`-bound icon renders as an empty
 * node. Every string passed through this pipe in this app is a hardcoded
 * constant authored in our own components, never user input, so bypassing
 * sanitization here is safe.
 */
@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
