import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ImportClient from "./ImportClient";

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
    </div>
  );
}
