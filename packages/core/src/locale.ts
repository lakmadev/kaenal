/** Tenant-locale resolution and Intl formatting (S1-7). English only for now (Q4). */

export const SUPPORTED_LOCALES = ["en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

function supported(tag: string | null | undefined): AppLocale | null {
  if (tag === null || tag === undefined) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0] ?? "";
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as AppLocale) : null;
}

/** user preference > tenant setting > Accept-Language > default. */
export function resolveLocale(input: {
  user?: string | null;
  tenant?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  const fromHeader = (input.acceptLanguage ?? "")
    .split(",")
    .map((p) => supported(p.split(";")[0]?.trim()))
    .find((l) => l !== null);
  return supported(input.user) ?? supported(input.tenant) ?? fromHeader ?? DEFAULT_LOCALE;
}

export function formatDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, opts).format(new Date(iso));
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, opts).format(n);
}

/** "just now", "8m ago", "3h ago", "2d ago"; null beyond a week (caller shows a date). */
export function formatRelative(iso: string, locale: string, nowMs: number = Date.now()): string | null {
  const secs = Math.round((nowMs - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat(locale, { style: "narrow" });
  const mins = Math.round(secs / 60);
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return null;
}
