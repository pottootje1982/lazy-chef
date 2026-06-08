"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale, LOCALE_COOKIE } from "@/i18n/request";

// Set the user's preferred UI language. Persists to the DB (follows the account
// across devices) and mirrors to the NEXT_LOCALE cookie so the next server render
// picks it up immediately. Guests can still switch for their session via cookie.
export async function setLanguage(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  // Cookie is the authoritative source for the active render (wins over JWT).
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  // Persist on the account for signed-in, non-guest users.
  const session = await auth();
  if (session?.user?.id && !session.user.isGuest) {
    await prisma.user.update({ where: { id: session.user.id }, data: { language: locale } });
  }

  revalidatePath("/", "layout");
}
