// Credit packs, priced in naira. 1 credit = 1 minute of live AI, billed by the second.
// Our cost is about $1.20 per minute (Decart Lucy 2.5 at $0.02/sec), roughly N1,600 at N1,330/$.
// If the naira moves a lot, update these prices (and NAIRA_PER_DOLLAR in the env).

export type CreditPack = {
  id: string;
  name: string;
  credits: number; // minutes
  priceNgn: number;
  tag?: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "try", name: "Try", credits: 2, priceNgn: 8_000 },
  { id: "starter", name: "Starter", credits: 10, priceNgn: 35_000 },
  { id: "creator", name: "Creator", credits: 30, priceNgn: 95_000, tag: "Most picked" },
  { id: "pro", name: "Pro", credits: 90, priceNgn: 250_000, tag: "Best rate" },
];

export function perMinuteNgn(pack: CreditPack): number {
  return pack.priceNgn / pack.credits;
}

export function lowestPerMinuteNgn(): number {
  return Math.min(...CREDIT_PACKS.map(perMinuteNgn));
}

export function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

// Paystack local card/bank fee in naira: 1.5% + N100 (the N100 is waived under N2,500), capped at N2,000.
export function paystackFeeNgn(amountNgn: number): number {
  if (amountNgn <= 0) return 0;
  const fee = amountNgn * 0.015 + (amountNgn >= 2_500 ? 100 : 0);
  return Math.min(2_000, Math.round(fee));
}

export function packById(id: string | null | undefined): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
