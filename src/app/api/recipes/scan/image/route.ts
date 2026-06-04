import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { scanCropSchema } from "@/lib/validation";
import { uploadRecipeImage, GcsConfigError } from "@/lib/gcs";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// POST multipart/form-data { image: File, x, y, w, h } (crop in natural pixels)
// → { imageUrl }. Crops the marked region and uploads it to GCS.
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

  const parsed = scanCropSchema.safeParse({
    x: form.get("x"),
    y: form.get("y"),
    w: form.get("w"),
    h: form.get("h"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid crop region." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const meta = await sharp(buf).metadata();
    const imgW = meta.width ?? 0;
    const imgH = meta.height ?? 0;
    if (!imgW || !imgH) {
      return NextResponse.json({ error: "Could not read image dimensions." }, { status: 422 });
    }

    // Clamp the crop to the image bounds so sharp.extract never errors.
    const left = Math.min(parsed.data.x, imgW - 1);
    const top = Math.min(parsed.data.y, imgH - 1);
    const width = Math.min(parsed.data.w, imgW - left);
    const height = Math.min(parsed.data.h, imgH - top);
    if (width < 1 || height < 1) {
      return NextResponse.json({ error: "Crop region is outside the image." }, { status: 400 });
    }

    const out = await sharp(buf)
      .extract({ left, top, width, height })
      .jpeg({ quality: 82 })
      .toBuffer();

    const imageUrl = await uploadRecipeImage(out, "image/jpeg");
    return NextResponse.json({ imageUrl });
  } catch (err) {
    if (err instanceof GcsConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Scan image crop/upload failed:", err);
    return NextResponse.json({ error: "Could not save the cropped image." }, { status: 500 });
  }
}
