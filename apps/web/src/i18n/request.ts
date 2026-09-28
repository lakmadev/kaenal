import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@kaenal/core";

/**
 * next-intl request config (no locale prefix in URLs). Locale comes from the
 * `kaenal_locale` cookie (user/tenant preference mirrored client-side), then
 * `Accept-Language`, then the default. English only for now (Q4).
 * An unknown message key renders as its key path (visible in dev, caught by
 * `test/i18n-catalog.test.ts` in CI).
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("kaenal_locale")?.value ?? null;
  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveLocale({ user: cookieLocale, acceptLanguage });
  const messages = (await import(`../../messages/${locale}.json`)) as { default: Record<string, unknown> };
  return {
    locale,
    messages: messages.default,
    getMessageFallback: ({ namespace, key }) => (namespace !== undefined ? `${namespace}.${key}` : key),
    onError: (err) => {
      if (process.env.NODE_ENV !== "production") console.error(err.message);
    },
  };
});
