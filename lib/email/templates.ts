import {
  amountBlock,
  button,
  callout,
  detailList,
  divider,
  escapeHtml,
  formatCurrency,
  formatDate,
  heading,
  listBlock,
  paragraph,
  qrBlock,
  renderEmail,
  sectionTitle,
} from "@/lib/email/layout";
import { emailTheme as t } from "@/lib/email/theme";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function reminderPrefix(reminderIndex: number): string {
  return reminderIndex > 0 ? "Připomínka: " : "";
}

function reminderNote(reminderIndex: number): string {
  if (reminderIndex <= 0) return "";
  return callout(
    `Tohle je <strong>${reminderIndex}. připomínka</strong>. Další pošleme za 24 hodin — dokud akci nepotvrdíte.`,
    "warning"
  );
}

/** 1) Dlužníkovi: „zaplať tuhle částku“ + QR + tlačítko. */
export function paymentRequestEmail(params: {
  recipientName: string;
  counterpartyName: string;
  companyName: string;
  eventName: string;
  amount: number;
  iban: string | null;
  paymentMessage: string;
  qrUrl: string | null;
  actionUrl: string;
  eventUrl: string;
  reminderIndex: number;
}): RenderedEmail {
  const subject = `${reminderPrefix(params.reminderIndex)}Vyúčtování „${params.eventName}“ — máte doplatit ${formatCurrency(params.amount)}`;

  const details = detailList([
    { label: "Akce", value: params.eventName },
    { label: "Firma", value: params.companyName },
    { label: "Příjemce", value: params.counterpartyName },
    ...(params.iban
      ? [{ label: "Účet", value: params.iban, mono: true }]
      : []),
    { label: "Zpráva pro příjemce", value: params.paymentMessage },
  ]);

  const qr = params.qrUrl
    ? qrBlock(
        params.qrUrl,
        "Naskenujte QR kód v bankovní aplikaci — částka i zpráva se vyplní samy."
      )
    : callout(
        `<strong>${escapeHtml(params.counterpartyName)}</strong> zatím nemá v profilu vyplněný IBAN, takže QR kód nelze vygenerovat. Domluvte se na platbě napřímo.`,
        "warning"
      );

  const html = renderEmail({
    title: subject,
    preheader: `${params.eventName} — ${formatCurrency(params.amount)} pro ${params.counterpartyName}`,
    body: `
${heading(`Dobrý den, ${params.recipientName}`)}
${paragraph(`Vyúčtování akce <strong>${escapeHtml(params.eventName)}</strong> je uzavřené. Podle rozdělení nákladů máte poslat peníze uživateli <strong>${escapeHtml(params.counterpartyName)}</strong>.`)}
${reminderNote(params.reminderIndex)}
${amountBlock("K úhradě", params.amount)}
${qr}
${details}
${paragraph(`Jakmile platbu odešlete, klepněte na tlačítko níž. ${escapeHtml(params.counterpartyName)} pak dostane e-mail, aby přijetí potvrdil/a.`, true)}
${button(params.actionUrl, "Zaplaceno — označit platbu")}
${divider()}
${paragraph(`Stejné tlačítko najdete i <a href="${escapeHtml(params.eventUrl)}" style="color:${t.brand};">v detailu akce ve Splitnito</a>, hned pod QR kódem.`, true)}
`,
    footerNote:
      "Připomínku posíláme každých 24 hodin, dokud platbu neoznačíte jako odeslanou.",
  });

  const text = [
    `Dobrý den, ${params.recipientName},`,
    "",
    `vyúčtování akce "${params.eventName}" (${params.companyName}) je uzavřené.`,
    `Máte poslat ${formatCurrency(params.amount)} uživateli ${params.counterpartyName}.`,
    params.iban ? `Účet: ${params.iban}` : "Příjemce nemá vyplněný IBAN.",
    `Zpráva pro příjemce: ${params.paymentMessage}`,
    "",
    `Platbu označte jako odeslanou zde: ${params.actionUrl}`,
    `Detail akce: ${params.eventUrl}`,
    "",
    "Splitnito",
  ].join("\n");

  return { subject, html, text };
}

/** 2) Věřiteli: „bylo vám zaplaceno, potvrďte přijetí“. */
export function paymentReceivedEmail(params: {
  recipientName: string;
  counterpartyName: string;
  companyName: string;
  eventName: string;
  amount: number;
  actionUrl: string;
  eventUrl: string;
  reminderIndex: number;
}): RenderedEmail {
  const subject = `${reminderPrefix(params.reminderIndex)}${params.counterpartyName} vám poslal/a ${formatCurrency(params.amount)} — potvrďte přijetí`;

  const html = renderEmail({
    title: subject,
    preheader: `${params.eventName} — potvrďte přijetí ${formatCurrency(params.amount)}`,
    body: `
${heading(`Dobrý den, ${params.recipientName}`)}
${paragraph(`<strong>${escapeHtml(params.counterpartyName)}</strong> označil/a platbu za akci <strong>${escapeHtml(params.eventName)}</strong> jako odeslanou.`)}
${reminderNote(params.reminderIndex)}
${amountBlock("Odesláno na váš účet", params.amount)}
${detailList([
  { label: "Akce", value: params.eventName },
  { label: "Firma", value: params.companyName },
  { label: "Od", value: params.counterpartyName },
])}
${paragraph("Zkontrolujte prosím svůj bankovní účet. Až peníze dorazí, potvrďte to tlačítkem — tím se vyúčtování uzavře.")}
${button(params.actionUrl, "Peníze dorazily — potvrdit")}
${divider()}
${paragraph(`Potvrdit můžete i <a href="${escapeHtml(params.eventUrl)}" style="color:${t.brand};">přímo v detailu akce ve Splitnito</a>.`, true)}
`,
    footerNote:
      "Připomínku posíláme každých 24 hodin, dokud přijetí platby nepotvrdíte.",
  });

  const text = [
    `Dobrý den, ${params.recipientName},`,
    "",
    `${params.counterpartyName} označil/a platbu ${formatCurrency(params.amount)} za akci "${params.eventName}" jako odeslanou.`,
    "",
    `Přijetí potvrďte zde: ${params.actionUrl}`,
    `Detail akce: ${params.eventUrl}`,
    "",
    "Splitnito",
  ].join("\n");

  return { subject, html, text };
}

export type SummaryMemberRow = {
  name: string;
  expenses: number;
  revenues: number;
  share: number;
  balance: number;
  isRecipient: boolean;
};

export type SummaryTransferRow = {
  fromName: string;
  toName: string;
  amount: number;
};

export type CompanyTotals = {
  eventCount: number;
  expenses: number;
  revenues: number;
  net: number;
};

/** 3) Všem: souhrn uzavřené a doplacené akce. */
export function eventSummaryEmail(params: {
  recipientName: string;
  companyName: string;
  eventName: string;
  closedAt: string;
  totalExpenses: number;
  totalRevenues: number;
  totalAmount: number;
  averageShare: number;
  members: SummaryMemberRow[];
  transfers: SummaryTransferRow[];
  companyTotals: CompanyTotals;
  eventUrl: string;
}): RenderedEmail {
  const subject = `Hotovo: vyúčtování „${params.eventName}“ je vyrovnané`;

  const memberRows = params.members.map((m) => {
    const parts = [`výdaje ${formatCurrency(m.expenses)}`];
    if (m.revenues > 0.005) parts.push(`tržby ${formatCurrency(m.revenues)}`);
    parts.push(`podíl ${formatCurrency(m.share)}`);

    return {
      title: `${m.name}${m.isRecipient ? " (vy)" : ""}`,
      subtitle: parts.join(" · "),
      value:
        m.balance > 0.005
          ? `+${formatCurrency(m.balance)}`
          : m.balance < -0.005
            ? formatCurrency(m.balance)
            : "vyrovnáno",
      valueColor:
        m.balance > 0.005 ? t.success : m.balance < -0.005 ? t.danger : t.muted,
    };
  });

  const transfersSection =
    params.transfers.length > 0
      ? `
${sectionTitle("Provedené platby")}
${listBlock(
  params.transfers.map((tr) => ({
    title: `${tr.fromName} → ${tr.toName}`,
    value: formatCurrency(tr.amount),
  }))
)}`
      : paragraph(
          "Všichni byli vyrovnaní — žádné převody nebyly potřeba.",
          true
        );

  const html = renderEmail({
    title: subject,
    preheader: `${params.eventName} — všechny platby potvrzeny, tady je souhrn.`,
    body: `
${heading(`Vyúčtování „${params.eventName}“ je hotové`)}
${paragraph(`Dobrý den, ${escapeHtml(params.recipientName)} — všechny platby jsou potvrzené, takže akci uzavíráme. Tady je kompletní souhrn.`)}
${callout(
  `<strong>Uzavřeno ${escapeHtml(formatDate(params.closedAt))}</strong> · ${escapeHtml(params.companyName)} · ${params.members.length} ${params.members.length === 1 ? "účastník" : params.members.length < 5 ? "účastníci" : "účastníků"}`,
  "success"
)}
${amountBlock("Náklady akce celkem", params.totalAmount)}
${detailList([
  { label: "Výdaje", value: formatCurrency(params.totalExpenses) },
  { label: "Tržby", value: `− ${formatCurrency(params.totalRevenues)}` },
  { label: "Podíl na osobu", value: formatCurrency(params.averageShare) },
])}
${divider()}
${sectionTitle("Rozpis podle účastníků")}
${listBlock(memberRows, {
  total: {
    title: "Celkem",
    subtitle: `výdaje ${formatCurrency(params.totalExpenses)} · tržby ${formatCurrency(params.totalRevenues)}`,
    value: formatCurrency(params.totalAmount),
  },
})}
${divider()}
${transfersSection}
${divider()}
${sectionTitle("Celkem za všechny uzavřené akce")}
${detailList([
  { label: "Počet akcí", value: String(params.companyTotals.eventCount) },
  { label: "Výdaje celkem", value: formatCurrency(params.companyTotals.expenses) },
  { label: "Tržby celkem", value: formatCurrency(params.companyTotals.revenues) },
  { label: "Čisté náklady", value: formatCurrency(params.companyTotals.net) },
])}
${button(params.eventUrl, "Zobrazit akci ve Splitnito", "outline")}
`,
    footerNote: "Tenhle e-mail dostali všichni účastníci akce.",
  });

  const textRows = params.members
    .map(
      (m) =>
        `- ${m.name}: výdaje ${formatCurrency(m.expenses)}, tržby ${formatCurrency(m.revenues)}, rozdíl ${formatCurrency(m.balance)}`
    )
    .join("\n");

  const text = [
    `Vyúčtování akce "${params.eventName}" (${params.companyName}) je hotové.`,
    "",
    `Náklady celkem: ${formatCurrency(params.totalAmount)}`,
    `Výdaje: ${formatCurrency(params.totalExpenses)} / tržby: ${formatCurrency(params.totalRevenues)}`,
    `Podíl na osobu: ${formatCurrency(params.averageShare)}`,
    "",
    "Rozpis:",
    textRows,
    "",
    "Celkem za všechny uzavřené akce:",
    `- Počet akcí: ${params.companyTotals.eventCount}`,
    `- Výdaje: ${formatCurrency(params.companyTotals.expenses)}`,
    `- Tržby: ${formatCurrency(params.companyTotals.revenues)}`,
    `- Čisté náklady: ${formatCurrency(params.companyTotals.net)}`,
    "",
    `Detail akce: ${params.eventUrl}`,
    "",
    "Splitnito",
  ].join("\n");

  return { subject, html, text };
}
