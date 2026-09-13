export interface AppSettings {
  pollIntervalSeconds: number;
  defaultSnmpCommunity: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassSet: boolean;
  smtpFromName: string;
  smtpFromEmail: string;
}

/** Everything but the password, which is only ever sent, never received. */
export type SettingsUpdate = Partial<Omit<AppSettings, 'smtpPassSet'>> & { smtpPass?: string };

export interface TestMailResult {
  ok: boolean;
  stage: 'connexion' | 'envoi';
  message: string;
}
