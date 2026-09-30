/**
 * Minor-version bumper for ECN's E5 auto-revise mechanism (SPRINT-06 §2 E5
 * AC4). `documents.version` is a plain numeric-dot `"X.Y"` string (never
 * semver-with-patch) — this parses that exact shape and increments `Y` by 1,
 * leaving `X` untouched.
 *
 * A malformed input (anything that isn't `"X.Y"` with non-negative integers)
 * is a named, pre-checked skip reason (`bad_version_format`) in the caller —
 * this function throws rather than guessing, so the caller's pre-check can
 * catch it before ever opening a `SAVEPOINT`.
 */

const VERSION_PATTERN = /^(\d+)\.(\d+)$/;

export function bumpMinorVersion(version: string): string {
  const match = VERSION_PATTERN.exec(version.trim());
  if (match === null) {
    throw new Error(`Not a numeric-dot version string: '${version}'`);
  }
  const major = match[1];
  const minor = match[2];
  if (major === undefined || minor === undefined) {
    throw new Error(`Not a numeric-dot version string: '${version}'`);
  }
  const nextMinor = Number.parseInt(minor, 10) + 1;
  return `${major}.${nextMinor}`;
}

/** True iff `bumpMinorVersion` would succeed on this string — lets callers
 *  pre-check without a try/catch at the call site. */
export function isBumpableVersion(version: string): boolean {
  return VERSION_PATTERN.test(version.trim());
}
