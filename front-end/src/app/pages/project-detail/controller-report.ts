import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import { APP_TIME_ZONE } from '../../core/time-zone';
import { Controller } from '../../models/controller';
import { Project } from '../../models/project';
import {
  BRAND_INK,
  CRIT,
  CRIT_SOFT,
  GOOD,
  GOOD_SOFT,
  INK,
  INK_MUTED,
  LINE,
  MARGIN,
  NEUTRAL,
  NEUTRAL_SOFT,
  SUNKEN,
  WHITE,
  coord,
  criticalityLabel,
  drawBrandHeader,
  drawFooter,
  formatDateCompact,
  loadImageWithRatio,
  LogoInfo,
  setFill,
  setText,
  slug,
  worstCriticality,
} from './pdf-shared';

/**
 * The printed project report, in the spirit of project-youness's
 * `analysis-report.ts` (same jsPDF + jspdf-autotable stack, same light-theme
 * design tokens so the paper matches the screen) but adapted to alarm
 * criticality instead of solar performance, and carrying both the Orange
 * Traffic and InfraPulse marks in the header to signal this deployment.
 */
const PAGE = { width: 297, height: 210 };
const HEADER_HEIGHT = 28;
const SUMMARY_HEIGHT = 16;

// Widths must sum to no more than PAGE.width - 2*MARGIN (273mm) — the
// previous set summed to 293mm, 20mm past the printable area, which pushed
// "Dernière comm." off the page instead of just wrapping it.
const COLUMNS: { header: string; width: number; align: 'left' | 'right' | 'center' }[] = [
  { header: 'Contrôleur', width: 38, align: 'left' },
  { header: 'IP:Port', width: 26, align: 'left' },
  { header: 'Coordonnées', width: 30, align: 'left' },
  { header: 'Modèle', width: 22, align: 'left' },
  { header: 'Statut', width: 22, align: 'center' },
  { header: 'Alarmes actives', width: 56, align: 'left' },
  { header: 'Criticité', width: 28, align: 'center' },
  { header: 'Dernière comm.', width: 48, align: 'right' },
];

function drawHeader(doc: jsPDF, projectName: string, logoOT: LogoInfo, logoIP: LogoInfo): void {
  drawBrandHeader(doc, PAGE.width, HEADER_HEIGHT, 'Rapport de supervision ATC-1500', projectName, logoOT, logoIP);
}

function drawSummary(
  doc: jsPDF,
  counts: { total: number; up: number; alarmed: number; offline: number }
): void {
  const tiles = [
    { label: 'Contrôleurs', value: counts.total, ink: INK, fill: SUNKEN },
    { label: 'Opérationnels', value: counts.up, ink: GOOD, fill: GOOD_SOFT },
    { label: 'Avec alarme(s)', value: counts.alarmed, ink: CRIT, fill: CRIT_SOFT },
    { label: 'Injoignables', value: counts.offline, ink: NEUTRAL, fill: NEUTRAL_SOFT },
  ];

  const gap = 3;
  const usable = PAGE.width - MARGIN * 2;
  const width = (usable - gap * (tiles.length - 1)) / tiles.length;
  const top = HEADER_HEIGHT + 6;

  tiles.forEach((tile, index) => {
    const left = MARGIN + index * (width + gap);
    setFill(doc, tile.fill);
    doc.roundedRect(left, top, width, SUMMARY_HEIGHT, 1.5, 1.5, 'F');
    setText(doc, tile.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(String(tile.value), left + 4, top + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(tile.label.toUpperCase(), left + 4, top + 13);
  });
}

function ensureSpace(doc: jsPDF, y: number, needed: number, projectName: string, logoOT: LogoInfo, logoIP: LogoInfo): number {
  if (y + needed <= PAGE.height - 16) return y;
  doc.addPage();
  drawHeader(doc, projectName, logoOT, logoIP);
  return HEADER_HEIGHT + 10;
}

/**
 * One detailed block per controller — the exhaustive per-device dump the
 * summary table deliberately omits.
 *
 * Every element is positioned by adding to a running cursor rather than by
 * independent magic offsets from `y` — the first version computed the
 * "ALARMES ACTIVES" heading and the field grid from separate formulas that
 * disagreed once there were more than a couple of fields, and the two
 * sections overlapped on the printed page.
 */
function drawControllerDetail(
  doc: jsPDF,
  controller: Controller,
  y: number,
  projectName: string,
  logoOT: LogoInfo,
  logoIP: LogoInfo
): number {
  const alarms = controller.lastSnapshot.alarms ?? [];
  const col2X = MARGIN + 95;
  const rowSpacing = 4.6;

  const fields: [string, string][] = [
    ['ID', controller._id],
    ['Modèle', controller.model || '—'],
    ['Coordonnées', coord(controller)],
    ['sysDescr', (controller.lastSnapshot.sysDescr || '—').slice(0, 42)],
    ['Statut connexion', controller.status ? 'Joignable' : 'Injoignable'],
    ['Dernière communication', controller.lastSeenAt ? new Date(controller.lastSeenAt).toLocaleString('fr-CA', { timeZone: APP_TIME_ZONE }) : '—'],
  ];
  const rawFields: [string, string][] = [
    ['unitAlarmStatus1', String(controller.lastSnapshot.unitAlarmStatus1 ?? '—')],
    ['unitAlarmStatus2', String(controller.lastSnapshot.unitAlarmStatus2 ?? '—')],
    ['shortAlarmStatus', String(controller.lastSnapshot.shortAlarmStatus ?? '—')],
  ];

  // Compute the full height up front (as offsets from `y`) so the background
  // box and the pagination check both agree with what is about to be drawn.
  const titleH = 16;
  const fieldsH = Math.max(fields.length, rawFields.length) * rowSpacing;
  const alarmsHeadingH = 6;
  const alarmsBodyH = Math.max(1, alarms.length) * 5;
  const bottomPad = 5;
  const blockHeight = titleH + fieldsH + alarmsHeadingH + alarmsBodyH + bottomPad;

  y = ensureSpace(doc, y, blockHeight + 6, projectName, logoOT, logoIP);

  setFill(doc, SUNKEN);
  doc.roundedRect(MARGIN, y, PAGE.width - MARGIN * 2, blockHeight, 1.5, 1.5, 'F');

  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(controller.nom, MARGIN + 4, y + 7);
  setText(doc, INK_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${controller.ip}:${controller.port}`, MARGIN + 4, y + 12);

  const fieldsTop = y + titleH;
  doc.setFontSize(7.5);
  fields.forEach(([label, value], i) => {
    const rowY = fieldsTop + i * rowSpacing;
    setText(doc, INK_MUTED);
    doc.text(`${label}:`, MARGIN + 4, rowY);
    setText(doc, INK);
    doc.text(String(value), MARGIN + 38, rowY);
  });
  rawFields.forEach(([label, value], i) => {
    const rowY = fieldsTop + i * rowSpacing;
    setText(doc, INK_MUTED);
    doc.text(`${label}:`, col2X, rowY);
    setText(doc, INK);
    doc.text(value, col2X + 32, rowY);
  });

  const alarmsTop = fieldsTop + fieldsH + 4;
  setText(doc, INK_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.text('ALARMES ACTIVES', MARGIN + 4, alarmsTop);

  const alarmsBodyTop = alarmsTop + 5;
  if (alarms.length === 0) {
    setText(doc, GOOD);
    doc.setFont('helvetica', 'normal');
    doc.text('Aucune alarme active', MARGIN + 4, alarmsBodyTop);
  } else {
    alarms.forEach((alarm, i) => {
      const rowY = alarmsBodyTop + i * 5;
      const critical = alarm.criticality === 'critical';
      setFill(doc, critical ? CRIT : NEUTRAL);
      doc.circle(MARGIN + 5, rowY - 1.3, 0.8, 'F');
      setText(doc, critical ? CRIT : INK);
      doc.setFont('helvetica', critical ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.text(alarm.label, MARGIN + 8, rowY);
      setText(doc, INK_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(`[${alarm.sourceObject}]`, PAGE.width - MARGIN - 4, rowY, { align: 'right' });
    });
  }

  return y + blockHeight + 5;
}

export async function downloadControllerReport(project: Project | null, controllers: Controller[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [logoOT, logoIP] = await Promise.all([
    loadImageWithRatio('assets/logo-mark.webp'),
    loadImageWithRatio('assets/infrapulse-logo.png'),
  ]);

  const projectName = project?.nom || 'Projet';
  const generatedAt = new Date().toLocaleString('fr-CA', { timeZone: APP_TIME_ZONE });

  const counts = {
    total: controllers.length,
    up: controllers.filter((c) => c.status && c.lastSnapshot.activeFlags.length === 0).length,
    alarmed: controllers.filter((c) => c.status && c.lastSnapshot.activeFlags.length > 0).length,
    offline: controllers.filter((c) => !c.status).length,
  };

  const ordered = [...controllers].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' }));

  autoTable(doc, {
    head: [COLUMNS.map((c) => c.header)],
    body: ordered.map((c) => {
      const level = worstCriticality(c.lastSnapshot.alarms ?? []);
      return [
        c.nom,
        `${c.ip}:${c.port}`,
        coord(c),
        c.model,
        c.status ? 'Joignable' : 'Injoignable',
        c.lastSnapshot.activeFlags.length ? c.lastSnapshot.activeFlags.join(' · ') : 'Aucune',
        criticalityLabel(level),
        c.lastSeenAt ? formatDateCompact(c.lastSeenAt) : '—',
      ];
    }),
    startY: HEADER_HEIGHT + SUMMARY_HEIGHT + 12,
    margin: { top: HEADER_HEIGHT + 6, left: MARGIN, right: MARGIN, bottom: 16 },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: BRAND_INK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [250, 248, 246] },
    columnStyles: Object.fromEntries(COLUMNS.map((c, i) => [i, { cellWidth: c.width, halign: c.align }])),
    didParseCell: (data: CellHookData) => {
      if (data.section === 'head') {
        data.cell.styles.halign = COLUMNS[data.column.index].align;
        return;
      }
      if (data.section !== 'body') return;

      if (data.column.index === 0) data.cell.styles.fontStyle = 'bold';
      if (data.column.index === 1) data.cell.styles.textColor = INK_MUTED;

      if (data.column.index === 4) {
        const up = ordered[data.row.index]?.status;
        data.cell.styles.textColor = up ? GOOD : NEUTRAL;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 6) {
        const level = worstCriticality(ordered[data.row.index]?.lastSnapshot.alarms ?? []);
        data.cell.styles.textColor = level === 'critical' ? CRIT : level === 'warning' ? NEUTRAL : GOOD;
        data.cell.styles.fillColor = level === 'critical' ? CRIT_SOFT : level === 'warning' ? NEUTRAL_SOFT : GOOD_SOFT;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => drawHeader(doc, projectName, logoOT, logoIP),
  });

  doc.setPage(1);
  drawSummary(doc, counts);

  // Detailed per-controller section, starting on a fresh page.
  doc.addPage();
  drawHeader(doc, projectName, logoOT, logoIP);
  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Détail par contrôleur', MARGIN, HEADER_HEIGHT + 8);
  let y = HEADER_HEIGHT + 14;
  for (const controller of ordered) {
    y = drawControllerDetail(doc, controller, y, projectName, logoOT, logoIP);
  }

  drawFooter(doc, PAGE.width, PAGE.height, projectName, generatedAt);

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`rapport-orange-traffic_${slug(projectName)}_${date}.pdf`);
}
