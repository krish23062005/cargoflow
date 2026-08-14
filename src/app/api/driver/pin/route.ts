import { hashPin, verifyPin, legacyVerifyPin } from "@/lib/pin";
import { prisma } from "@/lib/db";
import { getDriverContext } from "@/server/driver";

export const runtime = "nodejs";

/**
 * Driver self-service PIN change. Requires the current PIN for verification,
 * then updates the stored hash. Response sets a fresh session cookie via the
 * calling page (login not required since session already exists).
 */
export async function POST(req: Request) {
  const context = await getDriverContext();
  if (!context) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  if (typeof input.currentPin !== "string" || typeof input.newPin !== "string") {
    return Response.json({ error: "currentPin and newPin are required" }, { status: 400 });
  }

  const current = await prisma.driver.findUnique({
    where: { id: context.driverId, organizationId: context.organizationId },
    select: { pin: true },
  });
  if (!current) return Response.json({ error: "Driver not found" }, { status: 404 });

  if (!(verifyPin(input.currentPin, current.pin) || legacyVerifyPin(input.currentPin, current.pin))) {
    return Response.json({ error: "Current PIN is incorrect" }, { status: 400 });
  }

  const hashed = hashPin(input.newPin);
  if (!hashed) {
    return Response.json({ error: "New PIN must be 4–8 digits" }, { status: 400 });
  }

  await prisma.driver.update({
    where: { id: context.driverId, organizationId: context.organizationId },
    data: { pin: hashed },
  });

  return Response.json({ ok: true });
}