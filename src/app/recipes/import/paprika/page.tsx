import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PaprikaImportClient from "./PaprikaImportClient";

export default async function PaprikaImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paprikaEmail: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="text-sm text-stone-500 hover:text-stone-900">
        ← Settings
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Import from Paprika</h1>
      <p className="mt-1 text-sm text-stone-500">
        Load your Paprika recipes and pick which to import. Recipes you&apos;ve already imported
        are skipped automatically.
      </p>

      <div className="mt-6">
        {user?.paprikaEmail ? (
          <PaprikaImportClient />
        ) : (
          <div className="card p-6 text-sm text-stone-500">
            Connect your Paprika account first in{" "}
            <Link href="/settings" className="text-brand-600 hover:underline">
              Settings
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
