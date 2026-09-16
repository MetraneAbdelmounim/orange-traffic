import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { APP_TIME_ZONE } from './time-zone';

/**
 * Drop-in replacement for Angular's built-in `| date` pipe — Angular's
 * `DatePipe` does not reliably honour an IANA timezone name here (verified:
 * neither `DATE_PIPE_DEFAULT_OPTIONS` nor an explicit third pipe argument of
 * `'America/Toronto'` changed its output away from the browser's own local
 * timezone), while `Intl`/`toLocaleString` with an explicit `timeZone` option
 * does. Every displayed date must show the same fixed site timezone
 * regardless of the viewer's own browser/OS timezone — see core/time-zone.ts.
 *
 * `pure: false`, like TranslatePipe, so switching the language re-renders
 * already-displayed dates in the new locale immediately.
 */
@Pipe({ name: 'appDate', standalone: true, pure: false })
export class AppDatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(value: string | Date | null | undefined, style: 'short' | 'medium' | 'date' = 'medium'): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return '';

    // 'date' always renders dd/MM/yyyy regardless of app language, matching
    // the fixed admin-facing format the license page always used before —
    // en-GB happens to format that way reliably.
    if (style === 'date') {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: APP_TIME_ZONE });
    }

    const locale = this.i18n.lang() === 'fr' ? 'fr-CA' : 'en-US';
    const opts: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { dateStyle: 'short', timeStyle: 'short', timeZone: APP_TIME_ZONE }
        : { dateStyle: 'medium', timeStyle: 'medium', timeZone: APP_TIME_ZONE };
    return date.toLocaleString(locale, opts);
  }
}
