import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ScanImportClient from "./ScanImportClient";

export default async function ScanImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes/import" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to import
      </Link>
      <h1 className="mb-2 mt-3 text-2xl font-bold">Scan a recipe</h1>
      <p className="mb-6 text-sm text-stone-500">
        Upload or snap a photo of a recipe — or upload a PDF — then draw boxes around the title,
        ingredients, directions, and image. We&apos;ll read the text with OCR and fill in the form
        for you.
      </p>

      {isGuest ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This is a read-only guest account. Sign in with your own account to scan and save recipes.
        </div>
      ) : (
        <ScanImportClient />
      )}
    </div>
  );
}
