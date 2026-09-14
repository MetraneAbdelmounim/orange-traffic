import { Injectable, signal } from '@angular/core';
import { en } from './en';
import { fr, TranslationKey } from './fr';

export type Language = 'fr' | 'en';

const STORAGE_KEY = 'ot_lang';
const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { fr, en };

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * Lightweight custom dictionary i18n — same shape as projet-youness's own
 * `I18nService` (plain TS `Record<key,string>` objects rather than a
 * heavier library, an impure `| t` pipe so a language switch re-renders
 * without wiring change detection elsewhere). Built fresh here since this
 * app had no i18n system to reuse, but deliberately mirrors that proven
 * pattern rather than inventing a different one.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Language>(initialLanguage());

  constructor() {
    document.documentElement.lang = this.lang();
  }

  use(language: Language): void {
    localStorage.setItem(STORAGE_KEY, language);
    this.lang.set(language);
    document.documentElement.lang = language;
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const template = DICTIONARIES[this.lang()][key] ?? fr[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
  }
}
