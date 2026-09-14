import { Controller } from '../../models/controller';
import { Project } from '../../models/project';

/**
 * CSV export — doesn't exist anywhere in the app or in projet-youness (which
 * only has an .xlsx export via exceljs), so this is built from scratch.
 * Comma-separated with RFC 4180 quoting and a UTF-8 BOM prefix: the BOM is
 * what makes Excel auto-detect UTF-8 instead of guessing a local codepage
 * and mangling accented French characters (é, è, à…) on Windows.
 */
const COLUMNS = [
  'Project',
  'Controller',
  'Controller ID',
  'IP',
  'Latitude',
  'Longitude',
  'Type',
  'Firmware',
  'Connection Status',
  'Last Connection',
  'General Status',
  'unitAlarmStatus1',
  'unitAlarmStatus2',
  'shortAlarmStatus',
  'Active Alarms',
] as const;

/** Quotes a field only when it actually needs it, per RFC 4180. */
function csvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(',');
}

function generalStatus(c: Controller): string {
  if (!c.status) return 'Offline';
  return c.lastSnapshot.activeFlags.length > 0 ? 'Alarm' : 'OK';
}

export function downloadControllersCsv(project: Project | null, controllers: Controller[]): void {
  const projectName = project?.nom || 'Projet';
  const ordered = [...controllers].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' }));

  const lines = [
    csvRow([...COLUMNS]),
    ...ordered.map((c) =>
      csvRow([
        projectName,
        c.nom,
        c._id,
        c.ip,
        c.latitude,
        c.longitude,
        c.model,
        c.lastSnapshot.sysDescr || '',
        c.status ? 'Reachable' : 'Unreachable',
        c.lastSeenAt ? new Date(c.lastSeenAt).toISOString() : '',
        generalStatus(c),
        c.lastSnapshot.unitAlarmStatus1 ?? '',
        c.lastSnapshot.unitAlarmStatus2 ?? '',
        c.lastSnapshot.shortAlarmStatus ?? '',
        c.lastSnapshot.activeFlags.join('; '),
      ])
    ),
  ];

  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const slug = projectName.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'projet';

  const link = document.createElement('a');
  link.href = url;
  link.download = `controleurs-orange-traffic_${slug}_${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
