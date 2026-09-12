import { Injectable, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>((localStorage.getItem(KEY) as ThemeChoice) || 'system');

  cycle(): void {
    const order: ThemeChoice[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this.choice()) + 1) % order.length];
    this.set(next);
  }

  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    if (choice === 'system') {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, choice);
    }
    this.apply();
  }

  apply(): void {
    const stored = localStorage.getItem(KEY);
    const dark =
      stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }
}
