export type SettlementMember = {
  userId: string;
  name: string;
  iban: string | null;
  paid: number;
  share: number;
  balance: number;
};

export type PaymentStatus = "pending" | "confirmed";

export type SettlementTransfer = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toIban: string | null;
  amount: number;
  status: PaymentStatus;
};

export type SettlementSummary = {
  totalAmount: number;
  memberCount: number;
  averageShare: number;
  members: SettlementMember[];
  transfers: SettlementTransfer[];
  allPaid: boolean;
};

export function transferKey(t: {
  fromUserId: string;
  toUserId: string;
  amount: number;
}): string {
  return `${t.fromUserId}:${t.toUserId}:${t.amount.toFixed(2)}`;
}

/**
 * Férové dělení mezi uživateli (equal split).
 *
 * Každý má platit průměr (total / počet uživatelů).
 * balance = zaplaceno − průměr
 *   > 0 → má dostat (přeplatil)
 *   < 0 → má doplatit
 *
 * 2 uživatelé: kdo zaplatil míň, pošle druhému přesně rozdíl / 2
 *   (tj. doplatí, aby oba měli stejnou útratu).
 * Více uživatelů: greedy pairing dlužníků a věřitelů (min. počet převodů).
 */
export function calculateSettlement(
  members: { userId: string; name: string; iban: string | null; paid: number }[]
): SettlementSummary {
  const memberCount = members.length;
  const totalAmount = members.reduce((sum, m) => sum + m.paid, 0);
  const averageShare = memberCount === 0 ? 0 : totalAmount / memberCount;

  const settledMembers: SettlementMember[] = members.map((m) => ({
    ...m,
    share: averageShare,
    balance: roundMoney(m.paid - averageShare),
  }));

  const debtors = settledMembers
    .filter((m) => m.balance < -0.005)
    .map((m) => ({ ...m, remaining: Math.abs(m.balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = settledMembers
    .filter((m) => m.balance > 0.005)
    .map((m) => ({ ...m, remaining: m.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = roundMoney(
      Math.min(debtors[i].remaining, creditors[j].remaining)
    );
    if (amount > 0) {
      transfers.push({
        id: transferKey({
          fromUserId: debtors[i].userId,
          toUserId: creditors[j].userId,
          amount,
        }),
        fromUserId: debtors[i].userId,
        fromName: debtors[i].name,
        toUserId: creditors[j].userId,
        toName: creditors[j].name,
        toIban: creditors[j].iban,
        amount,
        status: "pending",
      });
    }
    debtors[i].remaining = roundMoney(debtors[i].remaining - amount);
    creditors[j].remaining = roundMoney(creditors[j].remaining - amount);
    if (debtors[i].remaining <= 0.005) i += 1;
    if (creditors[j].remaining <= 0.005) j += 1;
  }

  return {
    totalAmount: roundMoney(totalAmount),
    memberCount,
    averageShare: roundMoney(averageShare),
    members: settledMembers,
    transfers,
    allPaid: transfers.length === 0,
  };
}

export function normalizeSettlementSummary(raw: unknown): SettlementSummary {
  const data = raw as Partial<SettlementSummary> & {
    transfers?: Array<Partial<SettlementTransfer> & {
      fromUserId: string;
      toUserId: string;
      amount: number;
    }>;
  };

  const transfers: SettlementTransfer[] = (data.transfers ?? []).map((t) => ({
    id:
      t.id ??
      transferKey({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: Number(t.amount),
      }),
    fromUserId: t.fromUserId,
    fromName: t.fromName ?? "",
    toUserId: t.toUserId,
    toName: t.toName ?? "",
    toIban: t.toIban ?? null,
    amount: Number(t.amount),
    status: t.status === "confirmed" ? "confirmed" : "pending",
  }));

  return {
    totalAmount: Number(data.totalAmount ?? 0),
    memberCount: Number(data.memberCount ?? 0),
    averageShare: Number(data.averageShare ?? 0),
    members: (data.members ?? []) as SettlementMember[],
    transfers,
    allPaid:
      typeof data.allPaid === "boolean"
        ? data.allPaid
        : transfers.every((t) => t.status === "confirmed") ||
          transfers.length === 0,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function itemsSum(items: { totalPrice: number }[]): number {
  return roundMoney(items.reduce((s, i) => s + Number(i.totalPrice || 0), 0));
}

export function amountsMismatch(
  itemsTotal: number,
  receiptTotal: number,
  tolerance = 0.02
): boolean {
  if (!itemsTotal && itemsTotal !== 0) return false;
  // Only warn when there are items
  return Math.abs(itemsTotal - receiptTotal) > tolerance;
}
