import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ImportClient from "./ImportClient";
import ScanFilePicker from "./ScanFilePicker";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Import a recipe</h1>
      <p className="mb-6 text-sm text-stone-500">
        Paste a recipe URL and we&apos;ll pull in the title, ingredients, and steps. Review and edit
        before saving.
      </p>
      <ImportClient />

      <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h2 className="text-sm font-semibold text-stone-700">No link? Scan a photo or PDF</h2>
        <p className="mb-3 mt-1 text-sm text-stone-500">
          Pick a photo of a cookbook page or recipe card (or a PDF). On the next step you mark the
          title, ingredients, directions, and image, and we read the text with OCR.
        </p>
        <ScanFilePicker />
      </div>
    </div>
  );
}
