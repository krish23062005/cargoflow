import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY = "cargoflow.driver.pin";

/** Number of digits expected in a driver PIN (4–8). */
export const PIN_REGEX = /^\d{4,8}$/;

export function isValidPin(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

/**
 * Generate a cryptographically-random numeric PIN. Defaults to 6 digits — long
 * enough to be secure but short enough to type on a phone.
 */
export function generatePin(length = 6): string {
  const n = Math.max(4, Math.min(8, length));
  let pin = "";
  while (pin.length < n) {
    const chunk = randomBytes(6).readUInt32BE(0);
    pin += String(chunk % 10 ** n).padStart(n, "0");
  }
  return pin.slice(0, n);
}

/**
 * Hash a driver PIN with scrypt + a random per-pin salt.
 * Format: `scrypt$<salt-hex>$<hash-hex>`.
 */
export function hashPin(pin: string): string | null {
  if (!isValidPin(pin)) return null;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${KEY}:${pin}`, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/** Constant-time verify of a plaintext PIN against a stored hash. */
export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(`${KEY}:${pin}`, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

/** Legacy fallback for any plaintext PINs stored before hashing existed. */
export function legacyVerifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const hash = createHash("sha256").update(`${KEY}:${pin}`).digest("hex");
  return hash === stored;
}