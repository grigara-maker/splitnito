export type EmailProvider = "resend" | "smtp" | "none";

export type EmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
  fromName: string;
  replyTo: string | null;
  resendApiKey: string | null;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string | null;
    password: string | null;
  } | null;
};

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Poskytovatel se volí podle vyplněných proměnných: Resend má přednost,
 * jinak se použije SMTP. Bez konfigurace se e-maily jen logují.
 */
export function getEmailConfig(): EmailConfig {
  const resendApiKey = env("RESEND_API_KEY");
  const smtpHost = env("SMTP_HOST");

  const fromAddress =
    env("EMAIL_FROM") ?? env("SMTP_FROM") ?? "vyuctovani@splitnito.fun";
  const fromName = env("EMAIL_FROM_NAME") ?? "Splitnito";

  const provider: EmailProvider = resendApiKey
    ? "resend"
    : smtpHost
      ? "smtp"
      : "none";

  const portRaw = Number(env("SMTP_PORT") ?? 587);
  const port = Number.isFinite(portRaw) ? portRaw : 587;
  const secureRaw = env("SMTP_SECURE");
  const secure = secureRaw ? secureRaw === "true" : port === 465;

  return {
    provider,
    fromAddress,
    fromName,
    replyTo: env("EMAIL_REPLY_TO"),
    resendApiKey,
    smtp: smtpHost
      ? {
          host: smtpHost,
          port,
          secure,
          user: env("SMTP_USER"),
          password: env("SMTP_PASSWORD") ?? env("SMTP_PASS"),
        }
      : null,
  };
}

export function isEmailConfigured(): boolean {
  return getEmailConfig().provider !== "none";
}

/**
 * Tajemství pro podpis odkazů v e-mailech. Fallback na service-role klíč,
 * aby stačilo nastavit jednu proměnnou navíc jen když je potřeba rotace.
 */
export function getTokenSecret(): string | null {
  return (
    env("EMAIL_TOKEN_SECRET") ?? env("SUPABASE_SERVICE_ROLE_KEY") ?? null
  );
}
