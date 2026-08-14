require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const orgs = await sql`SELECT id, name, slug, country, currency, timezone, industry FROM "Organization"`;
  console.log("ORGS:", JSON.stringify(orgs, null, 1));

  const vamos = orgs.find((o) => o.slug === "vamos" || o.name.toLowerCase().includes("vamos"));
  if (!vamos) return;
  const orgId = vamos.id;

  const members = await sql`SELECT id, "userId", role FROM "Member" WHERE "organizationId" = ${orgId}`;
  console.log("\nMEMBERS:", JSON.stringify(members, null, 1));

  const users = await sql`SELECT id, name, email FROM "User" WHERE id IN (SELECT "userId" FROM "Member" WHERE "organizationId" = ${orgId})`;
  console.log("\nUSERS:", JSON.stringify(users, null, 1));

  const drivers = await sql`SELECT id, name, phone, email, status, "licenseExpiry" FROM "Driver" WHERE "organizationId" = ${orgId}`;
  console.log("\nDRIVERS:", JSON.stringify(drivers, null, 1));

  const counts = await sql`
    SELECT
      (SELECT count(*) FROM "Vehicle" WHERE "organizationId" = ${orgId}) AS vehicles,
      (SELECT count(*) FROM "VehicleAssignment" WHERE "organizationId" = ${orgId}) AS assignments,
      (SELECT count(*) FROM "Shipment" WHERE "organizationId" = ${orgId}) AS shipments,
      (SELECT count(*) FROM "Route" WHERE "organizationId" = ${orgId}) AS routes,
      (SELECT count(*) FROM "TrackingPoint" WHERE "organizationId" = ${orgId}) AS tracking_points,
      (SELECT count(*) FROM "Notification" WHERE "organizationId" = ${orgId}) AS notifications,
      (SELECT count(*) FROM "NotificationPreference" WHERE "organizationId" = ${orgId}) AS notif_prefs,
      (SELECT count(*) FROM "AuditLog" WHERE "organizationId" = ${orgId}) AS audit_logs,
      (SELECT count(*) FROM "ProofOfDelivery" WHERE "organizationId" = ${orgId}) AS pods,
      (SELECT count(*) FROM "EtaPrediction" WHERE "organizationId" = ${orgId}) AS etas,
      (SELECT count(*) FROM "Invitation" WHERE "organizationId" = ${orgId}) AS invitations
  `;
  console.log("\nCOUNTS:", JSON.stringify(counts, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});