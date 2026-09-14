import jsPDF from 'jspdf';
import { AlarmDetail, Controller } from '../../models/controller';

/**
 * Shared primitives for every PDF report (project-wide and single-controller)
 * — same design tokens, same logo-loading fix (WEBP alpha via canvas
 * re-encode, true aspect ratio instead of a fixed box), so the two reports
 * stay visually consistent without copy-pasting the fiddly parts twice.
 */
export type RGB = [number, number, number];

export const INK: RGB = [32, 29, 30];
export const INK_MUTED: RGB = [117, 107, 109];
export const LINE: RGB = [231, 224, 218];
export const SUNKEN: RGB = [240, 236, 232];
export const WHITE: RGB = [255, 255, 255];

export const BRAND: RGB = [255, 90, 31];
export const BRAND_INK: RGB = [184, 56, 10];

export const GOOD: RGB = [15, 122, 77];
export const GOOD_SOFT: RGB = [228, 246, 236];
export const CRIT: RGB = [198, 40, 40];
export const CRIT_SOFT: RGB = [253, 234, 234];
export const NEUTRAL: RGB = [107, 96, 98];
export const NEUTRAL_SOFT: RGB = [239, 234, 231];

export const MARGIN = 12;

export function setFill(doc: jsPDF, c: RGB): void {
  doc.setFillColor(c[0], c[1], c[2]);
}
export function setText(doc: jsPDF, c: RGB): void {
  doc.setTextColor(c[0], c[1], c[2]);
}

export type LogoInfo = { data: string; ratio: number } | null;

/** jsPDF cannot fetch a path on its own — this loads a local asset as a data URL. */
export async function loadImage(url: string): Promise<string | null> {
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
export async function loadImageWithRatio(url: string): Promise<LogoInfo> {
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

export function formatDateCompact(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const datePart = date.toLocaleDateString('fr-CA');
  const timePart = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}\n${timePart}`;
}

export function coord(c: Controller): string {
  const located = (Math.abs(c.latitude) > 0.001 || Math.abs(c.longitude) > 0.001) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180;
  return located ? `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}` : '—';
}

export function worstCriticality(alarms: AlarmDetail[]): 'critical' | 'warning' | null {
  if (alarms.some((a) => a.criticality === 'critical')) return 'critical';
  if (alarms.length > 0) return 'warning';
  return null;
}

export function criticalityLabel(level: 'critical' | 'warning' | null): string {
  return level === 'critical' ? 'Critique' : level === 'warning' ? 'Avertissement' : '—';
}

export function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'rapport'
  );
}

// Print-tuned heights, one per mark — not identical, so the very wide
// InfraPulse wordmark (natural ratio ~8.3) doesn't force a huge plate. The
// 11:8.3 balance mirrors the ratio already used for the on-screen lockup
// (see brand-logo.component.ts's size-lg: 2.6rem orange / 1.95rem infrapulse).
export const LOGO_OT_HEIGHT = 11;
export const LOGO_IP_HEIGHT = 8.3;
export const LOGO_GAP = 7;
export const LOGO_PAD_X = 4;
export const LOGO_PAD_Y = 4;

/** Draws the brand header band (both logos + title/subtitle) at a given header height. */
export function drawBrandHeader(
  doc: jsPDF,
  pageWidth: number,
  headerHeight: number,
  title: string,
  subtitle: string,
  logoOT: LogoInfo,
  logoIP: LogoInfo
): void {
  setFill(doc, BRAND);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  let textLeft = MARGIN;

  if (logoOT || logoIP) {
    const otW = logoOT ? LOGO_OT_HEIGHT * logoOT.ratio : 0;
    const ipW = logoIP ? LOGO_IP_HEIGHT * logoIP.ratio : 0;
    const plateWidth = LOGO_PAD_X * 2 + otW + (logoOT && logoIP ? LOGO_GAP : 0) + ipW;
    const plateHeight = Math.max(LOGO_OT_HEIGHT, LOGO_IP_HEIGHT) + LOGO_PAD_Y * 2;
    const plateTop = (headerHeight - plateHeight) / 2;

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
  doc.text(title, textLeft, headerHeight / 2 - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(subtitle, textLeft, headerHeight / 2 + 6);
}

export function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, label: string, generatedAt: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const y = pageHeight - 8;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 4, pageWidth - MARGIN, y - 4);
    setText(doc, INK_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${label} — généré le ${generatedAt}`, MARGIN, y);
    doc.text(`Page ${page} / ${pages}`, pageWidth - MARGIN, y, { align: 'right' });
  }
}
