import crypto from "crypto";

// Stateless, signed `state` for the AH OAuth flow. AH only allows the native
// `appie://login-exit` redirect, so the code is captured by a local handler and
// POSTed back to /api/ah/callback with NO session cookie. We therefore carry the
// connecting user's id in the OAuth `state` param, HMAC-signed so it can't be
// forged, with a short expiry. Reuses PICNIC_ENC_KEY (already required at boot).

function key(): Buffer {
  const raw = process.env.PICNIC_ENC_KEY;
  if (!raw) throw new Error("PICNIC_ENC_KEY is not set");
  return Buffer.from(raw, "base64");
}

const b64url = (b: Buffer) => b.toString("base64url");

export function signState(userId: string, ttlMs = 30 * 60 * 1000): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: Date.now() + ttlMs })));
  const sig = b64url(crypto.createHmac("sha256", key()).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the userId if the state is authentic and unexpired, else null.
export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", key()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof e !== "number" || Date.now() > e) return null;
    return u;
  } catch {
    return null;
  }
}
