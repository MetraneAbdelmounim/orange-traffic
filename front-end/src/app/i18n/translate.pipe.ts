import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslationKey } from './fr';

/**
 * Impure by design: Angular's default pure pipe would only re-evaluate when
 * its input key changes, not when the active language does — an impure pipe
 * re-runs on every change-detection tick, so `use(lang)` immediately updates
 * every `| t` on screen without each caller having to know how.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
