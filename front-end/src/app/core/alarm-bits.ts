import { Language } from '../i18n/i18n.service';

/**
 * Client-side mirror of `backend/python/decode.py`'s bit tables — used to
 * decode a raw historical reading value for a chart tooltip (the backend
 * already decodes the *current* snapshot into `lastSnapshot.alarms`, but
 * historical `Reading` documents only ever stored the raw integers), and to
 * translate the French labels the backend always sends (decode.py has no
 * locale concept) into English for display when English is selected.
 *
 * Keep these in sync with decode.py if the client's official bit tables
 * change — `label` (French) must match decode.py exactly, since it is also
 * used as the lookup key for `translateAlarmLabel`.
 */
export type Criticality = 'critical' | 'warning';

export interface AlarmBit {
  label: string;
  labelEn: string;
  criticality: Criticality;
}

export const UNIT_ALARM_STATUS_1_BITS: Record<number, AlarmBit> = {
  7: { label: 'CoordActive - coordination active', labelEn: 'CoordActive - coordination active', criticality: 'warning' },
  6: { label: 'Local Free - le contrôleur ne suit pas la coordination', labelEn: 'Local Free - controller is not following coordination', criticality: 'warning' },
  5: { label: 'Local Flash - entrée Local Flash active', labelEn: 'Local Flash - Local Flash input active', criticality: 'warning' },
  4: { label: 'MMU Flash - entrée MMU Flash active trop longtemps', labelEn: 'MMU Flash - MMU Flash input active too long', criticality: 'warning' },
  3: { label: 'Cycle Fail - défaut de cycle', labelEn: 'Cycle Fail - cycle fault', criticality: 'warning' },
  2: { label: 'Coord Fail - défaut de coordination', labelEn: 'Coord Fail - coordination fault', criticality: 'warning' },
  1: { label: 'Coord Fault - défaut de coordination en cours', labelEn: 'Coord Fault - coordination fault in progress', criticality: 'warning' },
  0: { label: 'Cycle Fault - défaut de cycle', labelEn: 'Cycle Fault - cycle fault', criticality: 'warning' },
};

// Official table supplied by the client. Bits 5-7 are Reserved and are
// deliberately absent — a reserved bit being set must never surface as a
// user-facing alarm.
export const UNIT_ALARM_STATUS_2_BITS: Record<number, AlarmBit> = {
  4: { label: 'Stop Time - entrée Stop Time active', labelEn: 'Stop Time - Stop Time input active', criticality: 'warning' },
  3: { label: 'External Start - entrée External Start active', labelEn: 'External Start - External Start input active', criticality: 'warning' },
  2: { label: 'Response Fault - défaut de réponse NEMA TS2 Port 1', labelEn: 'Response Fault - NEMA TS2 Port 1 response fault', criticality: 'warning' },
  1: { label: 'Low Battery - tension batterie trop faible', labelEn: 'Low Battery - battery voltage too low', criticality: 'warning' },
  0: { label: 'Power Restart - alimentation revenue après interruption', labelEn: 'Power Restart - power restored after interruption', criticality: 'warning' },
};

// Official table supplied by the client. Only bit 7 is "Critical Alarm".
export const SHORT_ALARM_STATUS_BITS: Record<number, AlarmBit> = {
  7: { label: 'Critical Alarm - Stop Time actif', labelEn: 'Critical Alarm - Stop Time active', criticality: 'critical' },
  6: { label: 'Non-Critical Alarm - entrée d’alarme physique active', labelEn: 'Non-Critical Alarm - physical alarm input active', criticality: 'warning' },
  5: { label: 'Detector Fault - défaut détecteur', labelEn: 'Detector Fault - detector fault', criticality: 'warning' },
  4: { label: 'Coordination Alarm - problème de coordination', labelEn: 'Coordination Alarm - coordination issue', criticality: 'warning' },
  3: { label: 'Local Override - override/local control', labelEn: 'Local Override - override/local control', criticality: 'warning' },
  2: { label: 'Local Cycle Zero - cycle local passé par zéro', labelEn: 'Local Cycle Zero - local cycle passed through zero', criticality: 'warning' },
  1: { label: 'T&F Flash - Local Flash ou MMU Flash actif', labelEn: 'T&F Flash - Local Flash or MMU Flash active', criticality: 'warning' },
  0: { label: 'Preempt - préemption active', labelEn: 'Preempt - preemption active', criticality: 'warning' },
};

const ALL_TABLES = [UNIT_ALARM_STATUS_1_BITS, UNIT_ALARM_STATUS_2_BITS, SHORT_ALARM_STATUS_BITS];

/** French label -> English label, built once from the tables above. */
const FR_TO_EN = new Map<string, string>();
for (const table of ALL_TABLES) {
  for (const bit of Object.values(table)) FR_TO_EN.set(bit.label, bit.labelEn);
}

/**
 * Translates a flag label the backend sent (always French — `decode.py` has
 * no locale concept) for display. Falls back to the original string for
 * anything not in the table (defensive — should not happen for real alarm
 * flags) rather than showing nothing.
 */
export function translateAlarmLabel(label: string, lang: Language): string {
  if (lang === 'fr') return label;
  return FR_TO_EN.get(label) ?? label;
}

/** Active flag labels for a bitmask value — always an array, empty when 0/null. */
export function decodeBits(value: number | null | undefined, table: Record<number, AlarmBit>, lang: Language = 'fr'): string[] {
  if (!value) return [];
  return Object.entries(table)
    .filter(([bit]) => value & (1 << Number(bit)))
    .map(([, entry]) => (lang === 'fr' ? entry.label : entry.labelEn));
}
