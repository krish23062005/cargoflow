import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

export const POD_QR_PREFIX = "CFV1";

/** Stable HMAC secret for delivery verification codes. */
function secret(): string {
  return (
    process.env.POD_VERIFY_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "cargoflow-delivery-verify"
  );
}

function hmac(trackingNumber: string): string {
  return createHmac("sha256", secret()).update(trackingNumber).digest("hex").slice(0, 16);
}

/**
 * Delivery QR payload: `CFV1:<trackingNumber>|<verification>`. Printing this on
 * the cargo label / delivery slip lets the driver (or a supervisor) scan it to
 * confirm identity before capturing proof of delivery.
 */
export function podQrPayload(trackingNumber: string): string {
  return `${POD_QR_PREFIX}:${trackingNumber}|${hmac(trackingNumber)}`;
}

/**
 * Verify a scanned/entered QR payload and return the shipment tracking number,
 * or `null` when the checksum doesn't match.
 */
export function verifyPodQrPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(`${POD_QR_PREFIX}:`)) {
    return parsedLegacyTracking(trimmed);
  }
  const body = trimmed.slice(POD_QR_PREFIX.length + 1);
  const sep = body.lastIndexOf("|");
  if (sep <= 0) return null;
  const trackingNumber = body.slice(0, sep);
  const signature = body.slice(sep + 1);
  if (!trackingNumber || !signature) return null;

  const expected = Buffer.from(hmac(trackingNumber), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return null;
  return timingSafeEqual(expected, received) ? trackingNumber : null;
}

/** Bare tracking numbers are accepted for QR-scanning convenience. */
function parsedLegacyTracking(trimmed: string): string | null {
  return /^[A-Z0-9]{4,32}$/.test(trimmed) ? trimmed : null;
}

/** Generate a PNG data URL of a delivery QR code. */
export async function generatePodQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}