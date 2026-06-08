import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

// Supported UI languages. Dutch is the default for everyone (logged out, guests,
// and new users) per product requirement.
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// Resolve the active locale: the explicit cookie wins (so switching in Settings
// is instant), then the signed-in user's saved preference (carried on the JWT,
// no DB hit — gives cross-device persistence on a fresh device), then Dutch.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  let locale: string | undefined = cookieLocale;
  if (!isLocale(locale)) {
    const session = await auth();
    locale = session?.user?.language;
  }
  if (!isLocale(locale)) locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
