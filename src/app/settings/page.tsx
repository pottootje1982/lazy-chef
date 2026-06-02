import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { picnicUnlink } from "@/lib/picnic-actions";
import { paprikaDisconnect } from "@/lib/paprika-actions";
import PicnicConnect from "./PicnicConnect";
import PaprikaConnect from "./PaprikaConnect";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id, status: "PLACED" },
      orderBy: { placedAt: "desc" },
      include: { items: true },
    }),
  ]);
  const linked = Boolean(user?.picnicAuthKey);
  const paprikaLinked = Boolean(user?.paprikaEmail);

  const euro = (cents: number) => "€" + (cents / 100).toFixed(2).replace(".", ",");
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Picnic grocery account</h2>
        <p className="mt-1 text-sm text-stone-500">
          Link your Picnic account to match recipe ingredients to real products from the Dutch
          online grocer.
        </p>

        <div className="mt-5">
          {linked ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Connected to Picnic
              </span>
              <form action={picnicUnlink}>
                <button className="btn-danger !py-1.5">Disconnect</button>
              </form>
            </div>
          ) : (
            <PicnicConnect />
          )}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Paprika sync</h2>
        <p className="mt-1 text-sm text-stone-500">
          Connect your Paprika account to import your recipes into this app.
        </p>
        <div className="mt-5">
          {paprikaLinked ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Connected as{" "}
                  {user?.paprikaEmail}
                </span>
                <form action={paprikaDisconnect}>
                  <button className="btn-danger !py-1.5">Disconnect</button>
                </form>
              </div>
              <Link href="/recipes/import/paprika" className="btn-primary">
                Import recipes from Paprika →
              </Link>
            </div>
          ) : (
            <PaprikaConnect />
          )}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Previous orders</h2>
        <p className="mt-1 text-sm text-stone-500">
          Orders you&apos;ve added to your Picnic cart.
        </p>

        {orders.length === 0 ? (
          <p className="mt-5 text-sm text-stone-400">No orders yet.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {orders.map((order) => {
              const total = order.items.reduce(
                (s, i) => s + (i.priceCents ?? 0) * i.quantity,
                0,
              );
              const count = order.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <li key={order.id} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{fmtDate(order.placedAt)}</span>
                    <span className="text-sm text-stone-500">
                      {count} product{count === 1 ? "" : "s"}
                      {total ? ` · ${euro(total)}` : ""}
                    </span>
                  </div>
                  {order.recipeTitles.length || order.listTitles.length ? (
                    <p className="mt-1 text-xs text-stone-500">
                      {[...order.recipeTitles, ...order.listTitles.map((t) => `🛒 ${t}`)].join(" · ")}
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-1 text-sm text-stone-600">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span className="truncate">
                          {item.productName}
                          {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                        </span>
                        {item.priceCents != null ? (
                          <span className="flex-none text-stone-400">
                            {euro(item.priceCents * item.quantity)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
