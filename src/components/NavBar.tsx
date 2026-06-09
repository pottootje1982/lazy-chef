"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/lib/auth-actions";

type NavLink = { href: string; label: string; primary?: boolean };

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900";

export default function NavBar({
  isGuest,
  displayName,
  cartCount = 0,
}: {
  isGuest: boolean;
  displayName: string;
  cartCount?: number;
}) {
  const t = useTranslations("nav");
  const ta = useTranslations("account");
  const [open, setOpen] = useState(false); // mobile hamburger
  const [menuOpen, setMenuOpen] = useState(false); // desktop account dropdown
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu when the viewport grows to desktop, so it doesn't
  // reappear already-open when shrinking back down.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close the account dropdown on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const links: NavLink[] = [
    { href: "/recipes", label: t("myRecipes") },
    { href: "/groceries", label: t("groceries") },
    // Write actions are hidden for the read-only guest account.
    ...(isGuest
      ? []
      : [
          { href: "/recipes/import", label: t("import") },
          { href: "/recipes/new", label: t("new"), primary: true },
        ]),
  ];

  // Items in the account dropdown (and the mobile menu's account section).
  const accountLinks: NavLink[] = isGuest
    ? []
    : [
        { href: "/week-plans", label: ta("weekPlans") },
        { href: "/orders", label: ta("orders") },
        { href: "/ingredients", label: ta("linkIngredients") },
        { href: "/pantry", label: ta("pantryStaples") },
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

        <div className="flex items-center gap-1 border-l border-stone-200 pl-3">
          {!isGuest ? (
            <Link href="/order" title={t("cart")} aria-label={t("cart")} className={`relative ${iconBtn}`}>
              <BasketIcon />
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {!isGuest ? (
            <Link href="/settings" title={t("settings")} aria-label={t("settings")} className={iconBtn}>
              <GearIcon />
            </Link>
          ) : null}

          {!isGuest ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                title={displayName}
                aria-label={t("accountMenu")}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={iconBtn}
              >
                <UserIcon />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                  <p className="truncate px-3 py-1.5 text-xs text-stone-400">{displayName}</p>
                  {accountLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <form action={signOutAction} className="mt-1 border-t border-stone-100 pt-1">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <SignOutIcon />
                      {t("signOut")}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : (
            <span title={displayName} aria-label={displayName} className="flex h-9 w-9 items-center justify-center text-stone-400">
              <UserIcon />
            </span>
          )}
        </div>
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("closeMenu") : t("openMenu")}
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

            {!isGuest ? (
              <div className="mt-1 flex flex-col border-t border-stone-100 pt-1">
                <Link
                  href="/order"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm text-stone-700"
                >
                  {t("cart")}
                  {cartCount > 0 ? (
                    <span className="ml-2 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm text-stone-700"
                >
                  {t("settings")}
                </Link>
                {accountLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-stone-700"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-1 flex items-center justify-between border-t border-stone-100 pt-2">
              <span className="text-sm text-stone-500">{displayName}</span>
              <form action={signOutAction}>
                <button className="text-sm font-medium text-stone-600 hover:text-stone-900">
                  {t("signOut")}
                </button>
              </form>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
