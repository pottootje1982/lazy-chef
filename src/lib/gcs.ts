import crypto from "node:crypto";
import { Storage } from "@google-cloud/storage";

// Thrown when GCS env vars are absent — routes turn this into a 503.
export class GcsConfigError extends Error {}

let _storage: Storage | null = null;

// Lazily build a Storage client from a base64-encoded service-account JSON in
// GCS_SA_KEY. Nothing is read from disk, so this works on Vercel's read-only FS.
function getStorage(): Storage {
  if (_storage) return _storage;
  const b64 = process.env.GCS_SA_KEY;
  if (!b64 || b64 === "base64-encoded-service-account-json") {
    throw new GcsConfigError("Image storage is not configured on this server.");
  }
  let credentials: { project_id?: string };
  try {
    credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new GcsConfigError("GCS service-account key is malformed.");
  }
  _storage = new Storage({ projectId: credentials.project_id, credentials });
  return _storage;
}

// Upload an image buffer to the recipe-scans/ prefix and return its public URL.
// The bucket must allow public reads (uniform bucket-level access + allUsers
// objectViewer), so we don't call makePublic() per object.
export async function uploadRecipeImage(buf: Buffer, contentType: string): Promise<string> {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName || bucketName === "your-bucket-name") {
    throw new GcsConfigError("Image storage bucket is not configured.");
  }

  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `recipe-scans/${crypto.randomUUID()}.${ext}`;

  await getStorage()
    .bucket(bucketName)
    .file(key)
    .save(buf, {
      contentType,
      resumable: false, // single PUT — fine for a few-MB crop on serverless
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });

  return `https://storage.googleapis.com/${bucketName}/${encodeURI(key)}`;
}
