import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectText, VisionConfigError, VisionRequestError } from "@/lib/vision";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// POST multipart/form-data { image: File } → { width, height, words[] }.
// Runs Google Vision OCR once; the image is not stored.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json({ error: "Guest account is read-only." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected an image upload." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 10 MB)." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const result = await detectText(buf);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VisionConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof VisionRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Scan OCR failed:", err);
    return NextResponse.json({ error: "Could not read text from that image." }, { status: 500 });
  }
}
