export interface LicenceStatus {
  installed: boolean;
  valid: boolean;
  type: 'demo' | 'licensed' | null;
  licenceId?: string;
  customer?: string;
  issuedAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  maxControllers?: number | null;
  daysRemaining: number;
}
