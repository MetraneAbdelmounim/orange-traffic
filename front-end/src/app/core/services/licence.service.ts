import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LicenceStatus } from '../../models/licence';

@Injectable({ providedIn: 'root' })
export class LicenceService {
  constructor(private http: HttpClient) {}

  status(): Promise<LicenceStatus> {
    return firstValueFrom(this.http.get<LicenceStatus>('/api/licence/status'));
  }

  activateDemo(): Promise<{ message: string; licence: LicenceStatus }> {
    return firstValueFrom(this.http.post<{ message: string; licence: LicenceStatus }>('/api/licence/demo', {}));
  }

  upload(file: File): Promise<{ message: string; licence: LicenceStatus }> {
    const form = new FormData();
    form.append('licence', file);
    return firstValueFrom(this.http.post<{ message: string; licence: LicenceStatus }>('/api/licence', form));
  }
}
