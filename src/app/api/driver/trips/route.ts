import { getDriverTrips } from "@/server/driver";

export const runtime = "nodejs";

/** Driver trip history (current + past assignments), newest first. */
export async function GET() {
  const trips = await getDriverTrips();
  if (!trips) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return Response.json({ trips });
}