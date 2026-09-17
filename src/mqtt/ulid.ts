const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(value: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

/** Crockford base32, 26 chars: 10 time + 16 random — the id format used in spec examples. */
export function ulid(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let random = "";
  for (const b of bytes) random += ALPHABET[b % 32];
  return encodeTime(now, 10) + random;
}
