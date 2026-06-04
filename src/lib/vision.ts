import sharp from "sharp";
import type { OcrWord } from "@/lib/ocr-layout";

export type OcrResult = { width: number; height: number; words: OcrWord[] };

// Thrown when the Vision API key is absent/placeholder — routes turn this into
// a 503 with a clear "not configured" message.
export class VisionConfigError extends Error {}
// Thrown on transport failure or a non-2xx Vision response — routes → 502.
export class VisionRequestError extends Error {}

type Vertex = { x?: number; y?: number };
type TextAnnotation = { description?: string; boundingPoly?: { vertices?: Vertex[] } };

// Convert Vision's 4-point polygon into an axis-aligned box. Vision omits a
// vertex's `x`/`y` when it is 0, so default missing coordinates to 0; using
// min/max tolerates mild skew/rotation of the polygon.
function toBox(vertices: Vertex[]): { x: number; y: number; w: number; h: number } {
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Run Google Cloud Vision DOCUMENT_TEXT_DETECTION on the image bytes and return
// every detected word with its bounding box (natural pixel coords) plus the
// image dimensions. The full image is sent inline (base64) and never stored.
export async function detectText(imageBytes: Buffer): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey || apiKey === "your-google-vision-api-key") {
    throw new VisionConfigError("OCR is not configured on this server.");
  }

  // Dimensions come from the image itself — Vision's annotate response omits them.
  const meta = await sharp(imageBytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let data: { responses?: { textAnnotations?: TextAnnotation[]; error?: { message?: string } }[] };
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBytes.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["en", "nl"] },
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`Vision API ${res.status}: ${detail.slice(0, 300)}`);
      throw new VisionRequestError(`Vision API returned ${res.status}.`);
    }
    data = await res.json();
  } catch (err) {
    if (err instanceof VisionRequestError) throw err;
    console.error("Vision API request failed:", err);
    throw new VisionRequestError("Could not reach the OCR service.");
  }

  const response = data.responses?.[0];
  if (response?.error?.message) {
    console.error("Vision API error:", response.error.message);
    throw new VisionRequestError(response.error.message);
  }

  // textAnnotations[0] is the whole-image aggregate; [1..] are individual words.
  const annotations = response?.textAnnotations ?? [];
  const words: OcrWord[] = annotations
    .slice(1)
    .map((a) => {
      const text = (a.description ?? "").trim();
      const vertices = a.boundingPoly?.vertices ?? [];
      if (!text || vertices.length === 0) return null;
      return { text, ...toBox(vertices) };
    })
    .filter((w): w is OcrWord => w !== null);

  return { width, height, words };
}
