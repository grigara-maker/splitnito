/** Veřejná URL aplikace Splitnito (invite odkazy, metadata). */
export const DEFAULT_SITE_URL = "https://splitnito.fun";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return DEFAULT_SITE_URL;
}

export function inviteRegisterUrl(inviteCode: string): string {
  const code = inviteCode.trim();
  return `${getSiteUrl()}/register?invite=${encodeURIComponent(code)}`;
}
