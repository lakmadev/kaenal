/**
 * Chargeback cost allocation (04 §Settings > Multi-tenancy > Cost centers).
 *
 * Splitting a shared platform cost across cost centers must be *conserved*: the
 * parts have to sum back to the whole, to the cent, or a finance export won't
 * reconcile. Naive per-center rounding drifts (three centers splitting $100
 * three ways as $33.33 each loses a cent). This module does integer-cent
 * largest-remainder (Hamilton) apportionment, which is exact by construction.
 *
 * Everything here is pure and unit-tested; the service supplies the real weights
 * (today: seats per cost center) and the totals.
 */

/** One weighted bucket to allocate to (a cost center, or the unallocated pool). */
export interface AllocationWeight {
  readonly key: string;
  /** Non-negative weight (e.g. seat count). Zero-weight buckets get 0. */
  readonly weight: number;
}

/** The amount, in cents, allocated to one bucket. */
export interface Allocation {
  readonly key: string;
  readonly amountCents: number;
}

/**
 * Split `totalCents` across `weights` so the results sum to EXACTLY `totalCents`.
 *
 * Each bucket first gets the floor of its proportional share; the leftover cents
 * (there are strictly fewer than the number of buckets) go one each to the
 * buckets with the largest fractional remainders, ties broken by input order.
 * If every weight is zero the total cannot be attributed, so all buckets get 0
 * and the caller keeps the remainder as unallocated.
 */
export function allocateConserved(totalCents: number, weights: readonly AllocationWeight[]): Allocation[] {
  const n = weights.length;
  if (n === 0) return [];

  const total = Math.trunc(totalCents);
  const totalWeight = weights.reduce((s, w) => s + Math.max(0, w.weight), 0);
  if (total <= 0 || totalWeight <= 0) {
    return weights.map((w) => ({ key: w.key, amountCents: 0 }));
  }

  // Floor share + remainder for each bucket.
  const parts = weights.map((w, i) => {
    const exact = (total * Math.max(0, w.weight)) / totalWeight;
    const floor = Math.floor(exact);
    return { key: w.key, floor, remainder: exact - floor, i };
  });

  const distributed = parts.reduce((s, p) => s + p.floor, 0);
  let leftover = total - distributed;

  // Hand the leftover cents to the largest remainders (stable on ties).
  const order = [...parts].sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const bump = new Set<number>();
  for (const p of order) {
    if (leftover <= 0) break;
    bump.add(p.i);
    leftover -= 1;
  }

  return parts.map((p) => ({ key: p.key, amountCents: p.floor + (bump.has(p.i) ? 1 : 0) }));
}
