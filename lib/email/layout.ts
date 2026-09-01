import { emailTheme as t } from "@/lib/email/theme";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(date);
}

/**
 * Výplň, rámeček i zaoblení drží samotný odkaz. Kdyby je nesla buňka,
 * globální `border-collapse: collapse` by rámeček vykreslil hranatě kolem
 * zaoblené výplně a vznikla by dvojitá hrana.
 */
export function button(
  href: string,
  label: string,
  variant: "primary" | "outline" = "primary"
): string {
  const bg = variant === "primary" ? t.brand : t.card;
  const color = variant === "primary" ? "#ffffff" : t.brand;
  const border = variant === "primary" ? t.brand : t.border;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:separate;">
  <tr>
    <td align="center" style="padding:0;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;background-color:${bg};border:1px solid ${border};border-radius:10px;padding:14px 26px;font-family:${t.fontSans};font-size:15px;font-weight:700;line-height:1.2;color:${color};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${t.fontHeading};font-size:24px;line-height:1.25;font-weight:600;color:${t.text};">${escapeHtml(text)}</h1>`;
}

export function paragraph(html: string, muted = false): string {
  return `<p style="margin:0 0 16px;font-family:${t.fontSans};font-size:15px;line-height:1.6;color:${muted ? t.muted : t.text};">${html}</p>`;
}

export function callout(
  html: string,
  tone: "neutral" | "success" | "warning" = "neutral"
): string {
  const bg =
    tone === "success"
      ? t.successSoft
      : tone === "warning"
        ? t.warningSoft
        : t.brandSoft;
  const color =
    tone === "success" ? t.success : tone === "warning" ? t.warning : t.brand;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td style="padding:14px 16px;background-color:${bg};border-radius:12px;font-family:${t.fontSans};font-size:14px;line-height:1.55;color:${color};">${html}</td>
  </tr>
</table>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 0 20px;"><div style="height:1px;line-height:1px;font-size:0;background-color:${t.divider};">&nbsp;</div></td></tr></table>`;
}

/** Velká částka + popisek — hlavní informace e-mailu. */
export function amountBlock(label: string, amount: number): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td align="center" style="padding:22px 16px;background-color:${t.brandSoft};border-radius:14px;">
      <div style="font-family:${t.fontSans};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${t.muted};">${escapeHtml(label)}</div>
      <!-- Bezpatkové písmo: Georgia má minuskové číslice, které by proti "Kč" seděly níž. -->
      <div style="margin-top:6px;font-family:${t.fontSans};font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:${t.brand};">${escapeHtml(formatCurrency(amount))}</div>
    </td>
  </tr>
</table>`;
}

export type DetailRow = { label: string; value: string; mono?: boolean };

export function detailList(rows: DetailRow[]): string {
  const body = rows
    .map(
      (row, index) => `
  <tr>
    <td valign="top" style="padding:${index === 0 ? "0" : "10px"} 12px 10px 0;font-family:${t.fontSans};font-size:14px;line-height:1.45;color:${t.muted};">${escapeHtml(row.label)}</td>
    <td align="right" valign="top" style="padding:${index === 0 ? "0" : "10px"} 0 10px;font-family:${row.mono ? t.fontMono : t.fontSans};font-size:14px;line-height:1.45;font-weight:600;color:${t.text};word-break:break-word;">${escapeHtml(row.value)}</td>
  </tr>`
    )
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:collapse;">
  ${body}
</table>`;
}

export type ListRow = {
  title: string;
  subtitle?: string;
  value: string;
  valueColor?: string;
  emphasis?: boolean;
};

/**
 * Dvousloupcový řádek (popis vlevo, částka vpravo). Používá se místo
 * širokých tabulek — na mobilu se nemá co zalomit ani přetéct.
 */
export function listBlock(
  rows: ListRow[],
  options: { total?: ListRow } = {}
): string {
  const renderRow = (row: ListRow, isTotal: boolean) => `
  <tr>
    <td style="padding:12px 12px 12px 0;border-top:1px solid ${isTotal ? t.border : t.divider};">
      <div style="font-family:${t.fontSans};font-size:15px;line-height:1.35;font-weight:${row.emphasis || isTotal ? 700 : 600};color:${t.text};">${escapeHtml(row.title)}</div>
      ${row.subtitle ? `<div style="margin-top:3px;font-family:${t.fontSans};font-size:13px;line-height:1.4;color:${t.muted};">${escapeHtml(row.subtitle)}</div>` : ""}
    </td>
    <td align="right" valign="top" style="padding:12px 0;border-top:1px solid ${isTotal ? t.border : t.divider};font-family:${t.fontSans};font-size:15px;font-weight:700;white-space:nowrap;color:${row.valueColor ?? t.text};">${escapeHtml(row.value)}</td>
  </tr>`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-collapse:collapse;">
  ${rows.map((row) => renderRow(row, false)).join("")}
  ${options.total ? renderRow(options.total, true) : ""}
</table>`;
}

export function sectionTitle(text: string): string {
  return `<div style="margin:0 0 12px;font-family:${t.fontSans};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;color:${t.muted};">${escapeHtml(text)}</div>`;
}

export function qrBlock(imageUrl: string, caption: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td align="center" style="padding:20px 16px;background-color:${t.card};border:1px solid ${t.border};border-radius:14px;">
      <img src="${escapeHtml(imageUrl)}" width="200" height="200" alt="QR platba" style="display:block;width:200px;max-width:100%;height:auto;border:0;border-radius:8px;" />
      <div style="margin-top:12px;font-family:${t.fontSans};font-size:13px;line-height:1.5;color:${t.muted};">${caption}</div>
    </td>
  </tr>
</table>`;
}

/** Kompletní HTML dokument e-mailu. */
export function renderEmail(options: {
  title: string;
  preheader: string;
  body: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="cs" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(options.title)}</title>
<style>
  body { margin:0; padding:0; width:100% !important; background-color:${t.pageBg}; -webkit-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse; }
  a { color:${t.brand}; }
  @media only screen and (max-width:620px) {
    .sn-wrap { width:100% !important; }
    .sn-pad { padding-left:20px !important; padding-right:20px !important; }
    .sn-hide-sm { display:none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${t.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${t.pageBg};">${escapeHtml(options.preheader)}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.pageBg};">
  <tr>
    <td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" class="sn-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:0 0 22px;">
            <span style="font-family:${t.fontHeading};font-size:22px;font-weight:600;letter-spacing:-0.01em;color:${t.brand};">Splitnito</span>
          </td>
        </tr>
        <tr>
          <td class="sn-pad" style="padding:32px;background-color:${t.card};border:1px solid ${t.border};border-radius:18px;">
            ${options.body}
          </td>
        </tr>
        <tr>
          <td class="sn-pad" style="padding:20px 32px 0;font-family:${t.fontSans};font-size:12px;line-height:1.6;color:${t.muted};" align="center">
            ${options.footerNote ? `${options.footerNote}<br />` : ""}
            Splitnito — chytré vyúčtování firemních nákladů.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
