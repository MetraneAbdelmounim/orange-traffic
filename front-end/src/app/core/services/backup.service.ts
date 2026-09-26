import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface RestoreResult {
  restored: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(private http: HttpClient) {}

  /**
   * Downloads the full backup and saves it client-side. Fetched as a blob
   * rather than a plain `<a href>` — the API needs the Bearer token the
   * auth interceptor attaches, which a bare navigation wouldn't send.
   */
  async download(): Promise<void> {
    const blob = await firstValueFrom(this.http.get('/api/backup', { responseType: 'blob' }));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orange-traffic-${stamp}.bkp`;
    link.click();
    URL.revokeObjectURL(url);
  }

  restore(file: File): Promise<RestoreResult> {
    const form = new FormData();
    form.append('backup', file);
    return firstValueFrom(this.http.post<RestoreResult>('/api/backup/restore', form));
  }
}
