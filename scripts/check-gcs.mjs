// Smoke-test the Google Cloud Storage setup used by the photo-scan importer.
// Uploads a 1×1 PNG to the configured bucket, confirms it's publicly readable,
// and prints the public URL.
//
//   npm run check:gcs        (loads GCS_BUCKET / GCS_SA_KEY from .env)
//
// Leaves a tiny test object under gcs-check/ — safe to delete from the console.
import crypto from "node:crypto";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const bucketName = process.env.GCS_BUCKET;
if (!bucketName || bucketName === "your-bucket-name") {
  fail("GCS_BUCKET is not set in .env (should be the bucket name, not a URL).");
}

const b64 = process.env.GCS_SA_KEY;
if (!b64 || b64 === "base64-encoded-service-account-json") {
  fail("GCS_SA_KEY is not set in .env (base64 of the service-account JSON file).");
}

let credentials;
try {
  credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
} catch {
  fail("GCS_SA_KEY is not valid base64-encoded JSON. Re-encode the whole key file:\n" +
    "  base64 -i service-account.json | tr -d '\\n' | pbcopy");
}
if (credentials.type !== "service_account") {
  fail(`Decoded GCS_SA_KEY is not a service-account key (type="${credentials.type}").`);
}

const storage = new Storage({ projectId: credentials.project_id, credentials });
const key = `gcs-check/${crypto.randomUUID()}.png`;

console.log(`Project:  ${credentials.project_id}`);
console.log(`Account:  ${credentials.client_email}`);
console.log(`Bucket:   ${bucketName}`);
console.log(`Uploading ${key} …`);

const png = await sharp({
  create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
})
  .png()
  .toBuffer();

try {
  await storage.bucket(bucketName).file(key).save(png, {
    contentType: "image/png",
    resumable: false,
    metadata: { cacheControl: "public, max-age=60" },
  });
} catch (err) {
  fail(`Upload failed — check the bucket name and that the service account has\n` +
    `   "Storage Object Admin" on it.\n   ${err?.message ?? err}`);
}

const url = `https://storage.googleapis.com/${bucketName}/${encodeURI(key)}`;
console.log(`✅ Uploaded. Public URL:\n   ${url}`);

// Confirm public-read works (the importer stores these URLs in Recipe.imageUrl).
try {
  const res = await fetch(url);
  if (res.ok) {
    console.log(`✅ Public read OK (HTTP ${res.status}). Bucket + key are working.`);
  } else {
    console.log(`⚠️  Uploaded, but public read returned HTTP ${res.status}.`);
    console.log(`   Grant "allUsers" the Storage Object Viewer role on the bucket`);
    console.log(`   and turn off "Public access prevention".`);
  }
} catch (err) {
  console.log(`⚠️  Uploaded, but could not fetch the public URL: ${err?.message ?? err}`);
}
