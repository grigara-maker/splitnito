export type SettlementMember = {
  userId: string;
  name: string;
  iban: string | null;
  paid: number;
  share: number;
  balance: number; // positive = should receive, negative = owes
};

export type SettlementTransfer = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toIban: string | null;
  amount: number;
};

export type SettlementSummary = {
  totalAmount: number;
  memberCount: number;
  averageShare: number;
  members: SettlementMember[];
  transfers: SettlementTransfer[];
};

/**
 * Equal split among all company members.
 * balance = paid - average (positive = credit / receives, negative = debt / pays)
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
        fromUserId: debtors[i].userId,
        fromName: debtors[i].name,
        toUserId: creditors[j].userId,
        toName: creditors[j].name,
        toIban: creditors[j].iban,
        amount,
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
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
