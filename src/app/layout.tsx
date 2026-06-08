import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { auth } from "@/lib/auth";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Recipe Manager",
  description: "Store recipes and import them from the web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale, messages, t] = await Promise.all([
    auth(),
    getLocale(),
    getMessages(),
    getTranslations("common"),
  ]);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="relative border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-bold text-brand-600">
                🍳 Recipe Manager
              </Link>
              {session?.user ? (
                <NavBar
                  isGuest={Boolean(session.user.isGuest)}
                  displayName={
                    session.user.isGuest
                      ? t("guest")
                      : (session.user.name ?? session.user.email ?? "")
                  }
                />
              ) : null}
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
