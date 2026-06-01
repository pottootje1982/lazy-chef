import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Recipe Manager",
  description: "Store recipes and import them from the web.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-600">
              🍳 Recipe Manager
            </Link>
            {session?.user ? (
              <nav className="flex items-center gap-3">
                <Link href="/recipes" className="text-sm text-stone-600 hover:text-stone-900">
                  My Recipes
                </Link>
                <Link href="/recipes/import" className="text-sm text-stone-600 hover:text-stone-900">
                  Import
                </Link>
                <Link href="/recipes/new" className="btn-primary !py-1.5">
                  + New
                </Link>
                <div className="flex items-center gap-2 border-l border-stone-200 pl-3">
                  <span className="hidden text-sm text-stone-500 sm:inline">
                    {session.user.name ?? session.user.email}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button className="text-sm text-stone-500 hover:text-stone-900">
                      Sign out
                    </button>
                  </form>
                </div>
              </nav>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
