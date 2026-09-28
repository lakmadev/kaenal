/**
 * Splits a `"<kind>:<id>-<kind>:<id>"` edge key (`GraphQueryResult.edgeKeys`,
 * `graph-queries.ts`'s `edgeKey`) against the known node-key set. A plain
 * split on the first `-` is unsafe because ids are UUIDs, which themselves
 * contain hyphens — so this checks every known key as a candidate prefix.
 */
export function parseServerEdgeKey(ek: string, validKeys: ReadonlySet<string>): [string, string] | null {
  for (const key of validKeys) {
    if (ek.startsWith(`${key}-`)) {
      const rest = ek.slice(key.length + 1);
      if (validKeys.has(rest)) return [key, rest];
    }
  }
  return null;
}
