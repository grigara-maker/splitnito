import { getEmailConfig } from "@/lib/email/config";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Odeslání přes Resend (HTTP) nebo SMTP (nodemailer) podle konfigurace.
 * Bez konfigurace se e-mail jen zaloguje, aby vývoj nespadl.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const config = getEmailConfig();
  const from = `${config.fromName} <${config.fromAddress}>`;

  if (config.provider === "none") {
    console.warn(
      `[splitnito/email] Není nastavený poskytovatel e-mailů — přeskočeno: „${message.subject}“ → ${message.to}`
    );
    return { ok: false, error: "Poskytovatel e-mailů není nastavený." };
  }

  try {
    if (config.provider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return {
          ok: false,
          error: `Resend ${response.status}: ${detail.slice(0, 300)}`,
        };
      }
      return { ok: true };
    }

    const smtp = config.smtp;
    if (!smtp) return { ok: false, error: "Chybí SMTP konfigurace." };

    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.user && smtp.password
          ? { user: smtp.user, pass: smtp.password }
          : undefined,
    });

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    });

    return { ok: true };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Neznámá chyba odeslání.";
    console.error("[splitnito/email] odeslání selhalo", detail);
    return { ok: false, error: detail };
  }
}
