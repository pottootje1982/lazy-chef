import crypto from "crypto";

// AES-256-GCM encryption for secrets at rest (the per-user Picnic auth key).
// Format: base64(iv).base64(authTag).base64(ciphertext)

function getKey(): Buffer {
  const raw = process.env.PICNIC_ENC_KEY;
  if (!raw) throw new Error("PICNIC_ENC_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PICNIC_ENC_KEY must decode to 32 bytes (use: openssl rand -base64 32)");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, ct] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  if (!iv || !tag || !ct) throw new Error("Malformed encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
