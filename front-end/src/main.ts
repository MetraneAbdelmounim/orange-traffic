import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Applies the stored theme before Angular boots, so there is no flash of the
 * wrong palette on load.
 */
(() => {
  const stored = localStorage.getItem('theme');
  const dark =
    stored === 'dark' ||
    (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
