import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import { AlarmDetail, Controller } from '../../models/controller';
import { Project } from '../../models/project';

/**
 * The printed controller report, in the spirit of project-youness's
 * `analysis-report.ts` (same jsPDF + jspdf-autotable stack, same light-theme
 * design tokens so the paper matches the screen) but adapted to alarm
 * criticality instead of solar performance, and carrying both the Orange
 * Traffic and InfraPulse marks in the header to signal this deployment.
 */
type RGB = [number, number, number];

const INK: RGB = [32, 29, 30];
const INK_MUTED: RGB = [117, 107, 109];
const LINE: RGB = [231, 224, 218];
const SUNKEN: RGB = [240, 236, 232];
const WHITE: RGB = [255, 255, 255];

const BRAND: RGB = [255, 90, 31];
const BRAND_INK: RGB = [184, 56, 10];

const GOOD: RGB = [15, 122, 77];
const GOOD_SOFT: RGB = [228, 246, 236];
const CRIT: RGB = [198, 40, 40];
const CRIT_SOFT: RGB = [253, 234, 234];
const NEUTRAL: RGB = [107, 96, 98];
const NEUTRAL_SOFT: RGB = [239, 234, 231];

const PAGE = { width: 297, height: 210 };
const MARGIN = 12;
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

function setFill(doc: jsPDF, c: RGB): void {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setText(doc: jsPDF, c: RGB): void {
  doc.setTextColor(c[0], c[1], c[2]);
}

type LogoInfo = { data: string; ratio: number } | null;

/** jsPDF cannot fetch a path on its own — this loads a local asset as a data URL. */
async function loadImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Loads a logo, re-encodes it as PNG via an offscreen canvas, and reports
 * its true pixel aspect ratio — two problems solved at once:
 *  - a fixed width/height box (the previous 28x10mm for InfraPulse's actual
 *    2153x260px asset, ratio 8.28) squashed it to a third of its natural
 *    width, so the caller instead gets a ratio and picks its own height;
 *  - jsPDF's own WEBP decoder does not composite alpha correctly (the
 *    Orange Traffic mark's transparent background came out solid black);
 *    routing every logo through a canvas draw uses the browser's decoder
 *    instead, which handles alpha correctly, and canvas always exports PNG.
 */
async function loadImageWithRatio(url: string): Promise<LogoInfo> {
  const raw = await loadImage(url);
  if (!raw) return null;
  return new Promise<LogoInfo>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ data: raw, ratio });
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ data: canvas.toDataURL('image/png'), ratio });
    };
    img.onerror = () => resolve(null);
    img.src = raw;
  });
}

function formatDateCompact(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const datePart = date.toLocaleDateString('fr-CA');
  const timePart = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}\n${timePart}`;
}

function coord(c: Controller): string {
  const located = (Math.abs(c.latitude) > 0.001 || Math.abs(c.longitude) > 0.001) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180;
  return located ? `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}` : '—';
}

function worstCriticality(alarms: AlarmDetail[]): 'critical' | 'warning' | null {
  if (alarms.some((a) => a.criticality === 'critical')) return 'critical';
  if (alarms.length > 0) return 'warning';
  return null;
}

function criticalityLabel(level: 'critical' | 'warning' | null): string {
  return level === 'critical' ? 'Critique' : level === 'warning' ? 'Avertissement' : '—';
}

// Print-tuned heights, one per mark — not identical, so the very wide
// InfraPulse wordmark (natural ratio ~8.3) doesn't force a huge plate. The
// 11:8.3 balance mirrors the ratio already used for the on-screen lockup
// (see brand-logo.component.ts's size-lg: 2.6rem orange / 1.95rem infrapulse).
const LOGO_OT_HEIGHT = 11;
const LOGO_IP_HEIGHT = 8.3;
const LOGO_GAP = 7;
const LOGO_PAD_X = 4;
const LOGO_PAD_Y = 4;

function drawHeader(doc: jsPDF, projectName: string, logoOT: LogoInfo, logoIP: LogoInfo): void {
  setFill(doc, BRAND);
  doc.rect(0, 0, PAGE.width, HEADER_HEIGHT, 'F');

  let textLeft = MARGIN;

  if (logoOT || logoIP) {
    const otW = logoOT ? LOGO_OT_HEIGHT * logoOT.ratio : 0;
    const ipW = logoIP ? LOGO_IP_HEIGHT * logoIP.ratio : 0;
    const plateWidth = LOGO_PAD_X * 2 + otW + (logoOT && logoIP ? LOGO_GAP : 0) + ipW;
    const plateHeight = Math.max(LOGO_OT_HEIGHT, LOGO_IP_HEIGHT) + LOGO_PAD_Y * 2;
    const plateTop = (HEADER_HEIGHT - plateHeight) / 2;

    setFill(doc, WHITE);
    doc.roundedRect(MARGIN, plateTop, plateWidth, plateHeight, 2, 2, 'F');

    try {
      let x = MARGIN + LOGO_PAD_X;
      if (logoOT) {
        const y = plateTop + (plateHeight - LOGO_OT_HEIGHT) / 2;
        doc.addImage(logoOT.data, 'PNG', x, y, otW, LOGO_OT_HEIGHT, undefined, 'FAST');
        x += otW + LOGO_GAP;
      }
      if (logoIP) {
        const y = plateTop + (plateHeight - LOGO_IP_HEIGHT) / 2;
        doc.addImage(logoIP.data, 'PNG', x, y, ipW, LOGO_IP_HEIGHT, undefined, 'FAST');
      }
    } catch {
      /* An unreadable image must not abort the report. */
    }
    textLeft = MARGIN + plateWidth + 8;
  }

  setText(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Rapport de supervision ATC-1500', textLeft, HEADER_HEIGHT / 2 - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(projectName, textLeft, HEADER_HEIGHT / 2 + 6);
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

function drawFooter(doc: jsPDF, projectName: string, generatedAt: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const y = PAGE.height - 8;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 4, PAGE.width - MARGIN, y - 4);
    setText(doc, INK_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${projectName} — généré le ${generatedAt}`, MARGIN, y);
    doc.text(`Page ${page} / ${pages}`, PAGE.width - MARGIN, y, { align: 'right' });
  }
}

function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'projet'
  );
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
    ['Modèle', controller.model || '—'],
    ['Coordonnées', coord(controller)],
    ['sysDescr', (controller.lastSnapshot.sysDescr || '—').slice(0, 42)],
    ['Statut connexion', controller.status ? 'Joignable' : 'Injoignable'],
    ['Dernière communication', controller.lastSeenAt ? new Date(controller.lastSeenAt).toLocaleString('fr-CA') : '—'],
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
  const generatedAt = new Date().toLocaleString('fr-CA');

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

  drawFooter(doc, projectName, generatedAt);

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`rapport-orange-traffic_${slug(projectName)}_${date}.pdf`);
}
