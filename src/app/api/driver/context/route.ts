import { getDriverContext } from "@/server/driver";

export const runtime = "nodejs";

/** Returns the current driver context (or 401 when not logged in). */
export async function GET() {
  const context = await getDriverContext();
  if (!context) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return Response.json(context);
}