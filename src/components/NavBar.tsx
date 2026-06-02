"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAction } from "@/lib/auth-actions";

type NavLink = { href: string; label: string; primary?: boolean };

export default function NavBar({
  isGuest,
  displayName,
}: {
  isGuest: boolean;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/recipes", label: "My Recipes" },
    { href: "/groceries", label: "Groceries" },
    // Write actions are hidden for the read-only guest account.
    ...(isGuest
      ? []
      : [
          { href: "/recipes/import", label: "Import" },
          { href: "/recipes/new", label: "+ New", primary: true },
          { href: "/settings", label: "Settings" },
        ]),
  ];

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-3 sm:flex">
        {links.map((l) =>
          l.primary ? (
            <Link key={l.href} href={l.href} className="btn-primary !py-1.5">
              {l.label}
            </Link>
          ) : (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              {l.label}
            </Link>
          ),
        )}
        <div className="flex items-center gap-2 border-l border-stone-200 pl-3">
          <span className="text-sm text-stone-500">{displayName}</span>
          <form action={signOutAction}>
            <button className="text-sm text-stone-500 hover:text-stone-900">Sign out</button>
          </form>
        </div>
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 sm:hidden"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown */}
      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 border-b border-stone-200 bg-white shadow-sm sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`py-2 text-sm ${
                  l.primary ? "font-semibold text-brand-600" : "text-stone-700"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-stone-100 pt-2">
              <span className="text-sm text-stone-500">{displayName}</span>
              <form action={signOutAction}>
                <button className="text-sm font-medium text-stone-600 hover:text-stone-900">
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
