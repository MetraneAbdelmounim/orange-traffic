import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSettings, SettingsUpdate, TestMailResult } from '../../models/settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private http: HttpClient) {}

  get(): Promise<AppSettings> {
    return firstValueFrom(this.http.get<AppSettings>('/api/settings'));
  }

  update(data: SettingsUpdate): Promise<AppSettings> {
    return firstValueFrom(this.http.put<AppSettings>('/api/settings', data));
  }

  /** Tests a candidate config without necessarily having saved it first. */
  testMail(data: SettingsUpdate & { to?: string }): Promise<TestMailResult> {
    return firstValueFrom(this.http.post<TestMailResult>('/api/settings/test-mail', data));
  }
}
