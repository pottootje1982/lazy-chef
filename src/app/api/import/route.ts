import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importSchema } from "@/lib/validation";
import { scrapeRecipe } from "@/lib/scrape";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid URL" },
      { status: 400 },
    );
  }

  try {
    const recipe = await scrapeRecipe(parsed.data.url);
    return NextResponse.json({ recipe });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import recipe.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
