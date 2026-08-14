/**
 * Generates a CargoFlow tracking number in the shape
 * `CF-<CC>-<YYYYMMDD>-<XXXX>` where CC is the org's country code and XXXX is
 * a 4-char uppercase alphanumeric random suffix. Uniqueness against the
 * database is enforced by the caller (the `@@unique` on trackingNumber).
 */
export function generateTrackingNumber(countryCode?: string | null): string {
  const cc = (countryCode ?? "NG").toUpperCase().slice(0, 2);
  const date = new Date();
  const yyyymmdd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  const suffix = Array.from({ length: 4 }, () =>
    alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
  ).join("");

  return `CF-${cc}-${yyyymmdd}-${suffix}`;
}