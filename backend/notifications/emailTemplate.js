const fs = require('fs');
const path = require('path');
const { APP_TIME_ZONE } = require('../config/timeZone');

// Same assets the built SPA serves — no duplicate copies to keep in sync.
const ASSETS_ROOT = path.join(__dirname, '../public/browser/assets');

function logoAttachment(filename, cid) {
  const filePath = path.join(ASSETS_ROOT, filename);
  if (!fs.existsSync(filePath)) return null;
  return { filename, path: filePath, cid };
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function criticalityBadge(level) {
  const color = level === 'critical' ? '#c62828' : '#b8380a';
  const label = level === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color}1a;color:${color};font-size:11px;font-weight:700;">${label}</span>`;
}

function controllerBlock(c) {
  const statusLabel = c.offline ? 'INJOIGNABLE' : c.worstCriticality === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT';
  const statusColor = c.offline ? '#6b6062' : c.worstCriticality === 'critical' ? '#c62828' : '#b8380a';
  const alarmsHtml = c.alarms.length
    ? `<ul style="margin:4px 0 0;padding-left:18px;">${c.alarms
        .map((a) => `<li style="margin-bottom:4px;">${escapeHtml(a.label)} ${criticalityBadge(a.criticality)}</li>`)
        .join('')}</ul>`
    : '<p style="margin:4px 0 0;color:#6b6062;">Aucune alarme active — contrôleur injoignable</p>';

  return `
    <table role="presentation" width="100%" style="margin-bottom:16px;border:1px solid #e7e0da;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#f7f4f1;padding:12px 16px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-weight:700;font-size:14px;color:#20191d;">${escapeHtml(c.nom)}</td>
            <td align="right"><span style="color:${statusColor};font-weight:700;font-size:12px;">${statusLabel}</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#20191d;">
          <p style="margin:0 0 4px;color:#75696b;">IP&nbsp;: <span style="font-family:monospace;">${escapeHtml(c.ip)}</span> &middot; Dernière connexion&nbsp;: ${c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString('fr-FR', { timeZone: APP_TIME_ZONE }) : '—'}</p>
          <p style="margin:8px 0 0;font-weight:600;">Alarmes actives</p>
          ${alarmsHtml}
        </td>
      </tr>
    </table>`;
}

/**
 * Builds the HTML body + logo attachments for one project's alert email.
 * `controllers`: [{ nom, ip, lastSeenAt, offline, worstCriticality, alarms: [{label, criticality}] }]
 */
function buildAlertEmail({ projectName, generatedAt, controllers }) {
  const totalAlarms = controllers.reduce((sum, c) => sum + c.alarms.length, 0);
  const worst = controllers.some((c) => c.worstCriticality === 'critical') ? 'critical' : 'warning';

  const logoOT = logoAttachment('logo-mark.webp', 'logo-ot');
  const logoIP = logoAttachment('infrapulse-logo.png', 'logo-ip');
  const attachments = [logoOT, logoIP].filter(Boolean);

  const logosHtml = attachments.length
    ? `<table role="presentation"><tr>
        ${logoOT ? '<td style="padding-right:10px;"><img src="cid:logo-ot" height="28" style="display:block;" alt="Orange Traffic" /></td>' : ''}
        ${logoIP ? '<td><img src="cid:logo-ip" height="20" style="display:block;" alt="InfraPulse" /></td>' : ''}
      </tr></table>`
    : '';

  const html = `
  <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#f7f4f1;padding:24px;">
    <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e0da;">
      <tr>
        <td style="background:#ff5a1f;padding:20px 24px;">
          ${logosHtml}
          <p style="margin:14px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Alerte critique</p>
          <p style="margin:2px 0 0;color:#ffe8dd;font-size:13px;">${escapeHtml(projectName)} &middot; ${generatedAt}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 4px;">
          <table role="presentation" width="100%" style="margin-bottom:16px;">
            <tr>
              <td style="padding:10px 14px;background:#f7f4f1;border-radius:8px;">
                <span style="font-size:20px;font-weight:700;color:#20191d;">${controllers.length}</span>
                <span style="font-size:12px;color:#75696b;"> contrôleur(s) concerné(s)</span>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:10px 14px;background:${worst === 'critical' ? '#fdeaea' : '#efeae7'};border-radius:8px;">
                <span style="font-size:20px;font-weight:700;color:${worst === 'critical' ? '#c62828' : '#6b6062'};">${totalAlarms}</span>
                <span style="font-size:12px;color:#75696b;"> alarme(s) active(s)</span>
              </td>
            </tr>
          </table>
          ${controllers.map(controllerBlock).join('')}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #e7e0da;color:#75696b;font-size:11px;">
          Orange Traffic — supervision NTCIP/SNMP. Cet e-mail a été envoyé automatiquement, ne pas répondre.
        </td>
      </tr>
    </table>
  </div>`;

  return { html, attachments };
}

module.exports = { buildAlertEmail };
