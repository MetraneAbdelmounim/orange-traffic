import { Project } from './project';

export interface AlarmDetail {
  label: string;
  bit: number;
  value: number;
  sourceObject: 'unitAlarmStatus1' | 'unitAlarmStatus2' | 'shortAlarmStatus';
  criticality: 'critical' | 'warning';
}

export interface ControllerSnapshot {
  reachable: boolean;
  measuredAt: string | null;
  error: string | null;
  /** Coarse cause behind `error` — 'timeout' | 'snmp_error' | 'network_error' | null. */
  errorReason: string | null;
  sysDescr: string | null;
  sysUpTimeTicks: number | null;
  unitAlarmStatus1: number | null;
  unitAlarmStatus2: number | null;
  shortAlarmStatus: number | null;
  /** Always an array — decoded flag names, never a raw integer. Empty = no alarm. */
  activeFlags: string[];
  /** Structured version of activeFlags — bit, source object and criticality per active alarm. */
  alarms: AlarmDetail[];
  /** Best-effort NTCIP groups, null when unsupported on this firmware. */
  phaseStatus: Record<string, number | null> | null;
  detectorStatus: Record<string, number | null> | null;
}

export interface MaintenanceInfo {
  note: string | null;
  by: string | null;
  at: string | null;
}

export interface AcknowledgmentInfo {
  flagsSnapshot: string | null;
  note: string | null;
  by: string | null;
  at: string | null;
}

export interface Controller {
  _id: string;
  project: Project | string | null;
  nom: string;
  ip: string;
  port: number;
  model: string;
  latitude: number;
  longitude: number;
  lastSnapshot: ControllerSnapshot;
  status: boolean;
  lastSeenAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  consecutiveFailures: number;
  /** Derived server-side from status + consecutiveFailures — see controllerController.js's withCommunicationState. */
  communicationState: 'reachable' | 'degraded' | 'unreachable';
  maintenanceMode: boolean;
  maintenance: MaintenanceInfo;
  /** Derived server-side: true only while acknowledgment.flagsSnapshot still matches the current alarm condition. */
  acknowledged: boolean;
  acknowledgment: AcknowledgmentInfo;
}

export interface ProjectKpiControllerRow {
  controllerId: string;
  nom: string;
  maintenanceMode: boolean;
  /** null when there is no reading data for the period (new controller, or past the retention window). */
  uptimePercent: number | null;
  alarmCount: number;
}

export interface ProjectKpi {
  days: number;
  generatedAt: string;
  summary: {
    avgUptimePercent: number | null;
    totalAlarmCount: number;
    controllerCount: number;
  };
  controllers: ProjectKpiControllerRow[];
}

export interface ControllerHistory {
  intervalSeconds: number;
  readings: Array<{
    ts: string;
    reachable: boolean;
    unitAlarmStatus1: number | null;
    unitAlarmStatus2: number | null;
    shortAlarmStatus: number | null;
    activeFlags: string[];
  }>;
}
