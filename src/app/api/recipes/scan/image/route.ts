import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { scanCropSchema } from "@/lib/validation";
import { uploadRecipeImage, GcsConfigError } from "@/lib/gcs";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// POST multipart/form-data { image: File, saveSource?, x?, y?, w?, h? } →
// { sourceImageUrl, imageUrl }. Stores the full source photo when saveSource="1";
// if a crop rect (natural pixels) is given, also stores that region as the recipe image.
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

  // Crop is optional — only validate when the client sent a rectangle.
  let crop: { x: number; y: number; w: number; h: number } | null = null;
  if (form.get("x") !== null) {
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
    crop = parsed.data;
  }

  const saveSource = form.get("saveSource") === "1";
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    let sourceImageUrl = "";
    if (saveSource) {
      // Full source photo — auto-orient (bake EXIF rotation) so it views upright.
      const sourceBuf = await sharp(buf).rotate().jpeg({ quality: 85 }).toBuffer();
      sourceImageUrl = await uploadRecipeImage(sourceBuf, "image/jpeg");
    }

    let imageUrl = "";
    if (crop) {
      const meta = await sharp(buf).metadata();
      const imgW = meta.width ?? 0;
      const imgH = meta.height ?? 0;
      if (imgW && imgH) {
        // Clamp the crop to the image bounds so sharp.extract never errors.
        const left = Math.min(crop.x, imgW - 1);
        const top = Math.min(crop.y, imgH - 1);
        const width = Math.min(crop.w, imgW - left);
        const height = Math.min(crop.h, imgH - top);
        if (width >= 1 && height >= 1) {
          const out = await sharp(buf)
            .extract({ left, top, width, height })
            .jpeg({ quality: 82 })
            .toBuffer();
          imageUrl = await uploadRecipeImage(out, "image/jpeg");
        }
      }
    }

    return NextResponse.json({ sourceImageUrl, imageUrl });
  } catch (err) {
    if (err instanceof GcsConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Scan image upload failed:", err);
    return NextResponse.json({ error: "Could not save the scan image." }, { status: 500 });
  }
}
