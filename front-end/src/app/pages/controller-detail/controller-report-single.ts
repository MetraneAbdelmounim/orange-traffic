import jsPDF from 'jspdf';
import { Controller } from '../../models/controller';
import { Project } from '../../models/project';
import {
  BRAND_INK,
  CRIT,
  GOOD,
  INK,
  INK_MUTED,
  MARGIN,
  NEUTRAL,
  SUNKEN,
  WHITE,
  coord,
  drawBrandHeader,
  drawFooter,
  loadImageWithRatio,
  setFill,
  setText,
  slug,
} from '../project-detail/pdf-shared';

const PAGE = { width: 297, height: 210 };
const HEADER_HEIGHT = 28;

export interface ChartImage {
  title: string;
  dataUrl: string;
  /** Natural pixel width/height of the source canvas, to size the image without deforming it. */
  width: number;
  height: number;
}

function projectName(project: Project | null | undefined, controller: Controller): string {
  if (project) return project.nom;
  if (controller.project && typeof controller.project === 'object') return controller.project.nom;
  return '—';
}

function drawInfoBlock(doc: jsPDF, controller: Controller, project: Project | null, generatedAt: string, periodLabel: string): number {
  const top = HEADER_HEIGHT + 8;
  const rowSpacing = 5;
  const col2X = MARGIN + 140;

  const general: [string, string][] = [
    ['Nom', controller.nom],
    ['ID', controller._id],
    ['Projet', projectName(project, controller)],
    ['Type', controller.model || '—'],
    ['Firmware / sysDescr', controller.lastSnapshot.sysDescr || '—'],
    ['IP:Port', `${controller.ip}:${controller.port}`],
    ['Coordonnées', coord(controller)],
  ];
  const status: [string, string][] = [
    ['État de connexion', controller.status ? 'Joignable' : 'Injoignable'],
    ['Dernière connexion', controller.lastSeenAt ? new Date(controller.lastSeenAt).toLocaleString('fr-CA') : '—'],
    ['État général', controller.status && controller.lastSnapshot.activeFlags.length === 0 ? 'OK' : controller.status ? 'Alarme' : 'Hors ligne'],
    ['Période analysée', periodLabel],
    ['Rapport généré le', generatedAt],
  ];

  const blockHeight = Math.max(general.length, status.length) * rowSpacing + 14;

  setFill(doc, SUNKEN);
  doc.roundedRect(MARGIN, top, PAGE.width - MARGIN * 2, blockHeight, 1.5, 1.5, 'F');

  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Informations générales', MARGIN + 4, top + 8);

  const rowsTop = top + 15;
  doc.setFontSize(8);
  general.forEach(([label, value], i) => {
    const y = rowsTop + i * rowSpacing;
    setText(doc, INK_MUTED);
    doc.text(`${label} :`, MARGIN + 4, y);
    setText(doc, INK);
    doc.text(String(value).slice(0, 60), MARGIN + 48, y);
  });
  status.forEach(([label, value], i) => {
    const y = rowsTop + i * rowSpacing;
    setText(doc, INK_MUTED);
    doc.text(`${label} :`, col2X, y);
    setText(doc, INK);
    doc.text(String(value), col2X + 42, y);
  });

  return top + blockHeight + 8;
}

function drawAlarmsBlock(doc: jsPDF, controller: Controller, y: number): number {
  const alarms = controller.lastSnapshot.alarms ?? [];
  const rawFields: [string, string][] = [
    ['unitAlarmStatus1', String(controller.lastSnapshot.unitAlarmStatus1 ?? '—')],
    ['unitAlarmStatus2', String(controller.lastSnapshot.unitAlarmStatus2 ?? '—')],
    ['shortAlarmStatus', String(controller.lastSnapshot.shortAlarmStatus ?? '—')],
  ];

  const titleH = 8;
  const rawH = 6;
  const alarmsH = Math.max(1, alarms.length) * 5.5;
  const blockHeight = titleH + rawH + alarmsH + 8;

  setFill(doc, SUNKEN);
  doc.roundedRect(MARGIN, y, PAGE.width - MARGIN * 2, blockHeight, 1.5, 1.5, 'F');

  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('État des alarmes NTCIP 1202', MARGIN + 4, y + 8);

  setText(doc, INK_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    rawFields.map(([label, value]) => `${label} = ${value}`).join('     '),
    MARGIN + 4,
    y + titleH + 6
  );

  const alarmsTop = y + titleH + rawH + 8;
  if (alarms.length === 0) {
    setText(doc, GOOD);
    doc.text('Aucune alarme active', MARGIN + 4, alarmsTop);
  } else {
    alarms.forEach((alarm, i) => {
      const rowY = alarmsTop + i * 5.5;
      const critical = alarm.criticality === 'critical';
      setFill(doc, critical ? CRIT : NEUTRAL);
      doc.circle(MARGIN + 5, rowY - 1.3, 0.8, 'F');
      setText(doc, critical ? CRIT : INK);
      doc.setFont('helvetica', critical ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.text(alarm.label, MARGIN + 8, rowY);
      setText(doc, INK_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(
        `${critical ? 'Critique' : 'Avertissement'} · ${alarm.sourceObject} · bit ${alarm.bit}`,
        PAGE.width - MARGIN - 4,
        rowY,
        { align: 'right' }
      );
    });
  }

  return y + blockHeight + 8;
}

function drawCharts(doc: jsPDF, charts: ChartImage[]): void {
  if (!charts.length) return;

  setText(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Historique des alarmes', MARGIN, HEADER_HEIGHT + 10);

  const gap = 6;
  const cols = 2;
  const cellW = (PAGE.width - MARGIN * 2 - gap) / cols;
  const cellH = 68;
  const top = HEADER_HEIGHT + 16;

  charts.forEach((chart, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cellW + gap);
    const y = top + row * (cellH + gap);

    setText(doc, INK_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(chart.title.toUpperCase(), x, y);

    // Fit the chart image inside the cell without deforming it — same
    // "compute width/height from the real aspect ratio" rule as the logos.
    const ratio = chart.width / chart.height;
    let w = cellW;
    let h = w / ratio;
    const maxH = cellH - 6;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    try {
      doc.addImage(chart.dataUrl, 'PNG', x, y + 3, w, h, undefined, 'FAST');
    } catch {
      /* An unreadable chart image must not abort the report. */
    }
  });
}

export async function downloadSingleControllerReport(
  controller: Controller,
  project: Project | null,
  charts: ChartImage[],
  periodLabel: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [logoOT, logoIP] = await Promise.all([
    loadImageWithRatio('assets/logo-mark.webp'),
    loadImageWithRatio('assets/infrapulse-logo.png'),
  ]);

  const pName = projectName(project, controller);
  const generatedAt = new Date().toLocaleString('fr-CA');
  const header = () => drawBrandHeader(doc, PAGE.width, HEADER_HEIGHT, 'Rapport contrôleur', controller.nom, logoOT, logoIP);

  header();
  let y = drawInfoBlock(doc, controller, project, generatedAt, periodLabel);
  drawAlarmsBlock(doc, controller, y);

  if (charts.length) {
    doc.addPage();
    header();
    drawCharts(doc, charts);
  }

  drawFooter(doc, PAGE.width, PAGE.height, `${controller.nom} — ${pName}`, generatedAt);

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`rapport-controleur_${slug(controller.nom)}_${date}.pdf`);
}
