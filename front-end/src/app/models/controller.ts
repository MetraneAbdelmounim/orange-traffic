import { Project } from './project';

export interface ControllerSnapshot {
  reachable: boolean;
  measuredAt: string | null;
  error: string | null;
  sysDescr: string | null;
  sysUpTimeTicks: number | null;
  unitAlarmStatus1: number | null;
  unitAlarmStatus2: number | null;
  shortAlarmStatus: number | null;
  /** Always an array — decoded flag names, never a raw integer. Empty = no alarm. */
  activeFlags: string[];
  /** Best-effort NTCIP groups, null when unsupported on this firmware. */
  phaseStatus: Record<string, number | null> | null;
  detectorStatus: Record<string, number | null> | null;
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
