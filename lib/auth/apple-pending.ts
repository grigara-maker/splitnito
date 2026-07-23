import { cookies } from "next/headers";

export type PendingAppleSetup = {
  accountType: "company" | "member";
  companyName: string | null;
  inviteCode: string | null;
  name: string | null;
  iban: string | null;
};

const COOKIE = "splitnito_apple_setup";
const MAX_AGE_SEC = 60 * 15;

export async function setPendingAppleSetup(
  data: PendingAppleSetup
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function getPendingAppleSetup(): Promise<PendingAppleSetup | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingAppleSetup;
    if (parsed.accountType !== "company" && parsed.accountType !== "member") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingAppleSetup(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
