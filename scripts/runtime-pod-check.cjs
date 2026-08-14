/* Runtime verification of the Episode 14 Proof-of-Delivery flow against the
 * live Next.js server + Neon DB. Creates a throwaway org-agnostic fixture
 * (driver + vehicle + active assignment + shipment), logs in as the driver,
 * exercises GET/POST /api/driver/pod, verifies DB side effects, then deletes
 * every row it created. Temporary — safe to delete afterwards. */
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const { randomBytes, scryptSync, createHmac } = require("node:crypto");

const sql = neon(process.env.DATABASE_URL);
const API = process.env.RUNTIME_CHECK_API || "http://localhost:3100";
const PIN = "2468";
const KEY = "cargoflow.driver.pin";

let failed = 0;
function check(name, ok, extra) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed += 1;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function idTag(tag) {
  // Keep id prefixes obvious so the fixture is recognisable in the DB.
  return `${tag}_${randomBytes(6).toString("hex")}`;
}

async function main() {
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  // ---- fixture ----------------------------------------------------------
  const { id: orgId } = (await sql`SELECT id FROM "Organization" ORDER BY "createdAt" LIMIT 1`)[0];
  let vehicleCid = null;
  const plate = `RT${idTag("").toUpperCase().slice(0, 8)}`;
  let vehRows = await sql`SELECT id FROM "Vehicle" WHERE "organizationId" = ${orgId} LIMIT 1`;
  let vehicleId;
  if (vehRows.length) {
    vehicleId = vehRows[0].id;
  } else {
    vehicleId = idTag("vh");
    vehicleCid = vehicleId;
    await sql`INSERT INTO "Vehicle" (id, "organizationId", "plateNumber", make, model, year, type, status, "createdAt", "updatedAt") VALUES (${vehicleId}, ${orgId}, ${plate}, 'Toyota', 'RuntimeCheck', 2026, 'TRUCK', 'ASSIGNED', NOW(), NOW())`;
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${KEY}:${PIN}`, salt, 32).toString("hex");
  const storedPin = `scrypt$${salt}$${hash}`;
  const driverId = idTag("dr");
  const driverName = "Runtime Check Driver";
  const phone = "234910224488";
  const lic = `RT-${randomBytes(4).toString("hex").toUpperCase()}`;
  await sql`INSERT INTO "Driver" (id, "organizationId", name, phone, "licenseNumber", "licenseExpiry", status, pin, "createdAt", "updatedAt") VALUES (${driverId}, ${orgId}, ${driverName}, ${phone}, ${lic}, '2028-01-01T00:00:00.000Z', 'ASSIGNED', ${storedPin}, NOW(), NOW())`;

  const assignmentId = idTag("as");
  await sql`INSERT INTO "VehicleAssignment" (id, "organizationId", "vehicleId", "driverId", status, "startDate", "updatedAt") VALUES (${assignmentId}, ${orgId}, ${vehicleId}, ${driverId}, 'ACTIVE', NOW(), NOW())`;

  const tracking = `CF-RT-${randomBytes(3).toString("hex").toUpperCase()}`;
  const shipmentId = idTag("sh");
  await sql`INSERT INTO "Shipment" (id, "organizationId", "trackingNumber", status, "customerName", "originAddress", "destinationAddress", "cargoType", "assignmentId", "createdAt", "updatedAt") VALUES (${shipmentId}, ${orgId}, ${tracking}, 'IN_TRANSIT', 'Runtime Check Customer', '1 Test Way, Lagos', '2 Test Ave, Abuja', 'Electronics', ${assignmentId}, NOW(), NOW())`;

  // A second shipment NOT in the assignment — for the negative test.
  const otherShipmentId = idTag("sh2");
  await sql`INSERT INTO "Shipment" (id, "organizationId", "trackingNumber", status, "customerName", "originAddress", "destinationAddress", "cargoType", "createdAt", "updatedAt") VALUES (${otherShipmentId}, ${orgId}, ${tracking + "X"}, 'IN_TRANSIT', 'Other Customer', 'A St', 'B St', 'Furniture', NOW(), NOW())`;

  const created = new Set([driverId, assignmentId, shipmentId, otherShipmentId]);
  if (vehicleCid) created.add(vehicleCid);
  let cleaned = new Set([]);

  try {
    // ---- wait for server -------------------------------------------------
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${API}/api/driver/pod`);
        if (r.status === 401) { up = true; break; }
      } catch { /* server still booting */ }
      await sleep(1000);
    }
    check("server up (401 on unauth GET /api/driver/pod)", up, up ? undefined : "no response after 60s");

    // ---- login -----------------------------------------------------------
    const loginRes = await fetch(`${API}/api/driver/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, pin: PIN }),
    });
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const cookieMatch = setCookie.match(/cf_driver_session=([^;,]+)/);
    check("driver login 200", loginRes.status === 200, `status=${loginRes.status}`);
    check("driver session cookie issued", Boolean(cookieMatch), cookieMatch ? "" : `set-cookie=${setCookie}`);
    const cookie = cookieMatch ? `cf_driver_session=${cookieMatch[1]}` : "";

    // ---- unauthenticated POST rejected ------------------------------------
    const unauthPost = await fetch(`${API}/api/driver/pod`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipmentId }),
    });
    check("POD POST without cookie rejected (401)", unauthPost.status === 401, `status=${unauthPost.status}`);

    if (!cookieMatch) throw new Error("abort: no session cookie");

    // ---- authenticated GET: shipment + qr ---------------------------------
    const getRes = await fetch(`${API}/api/driver/pod`, {
      headers: { cookie },
    });
    const getBody = await getRes.json();
    check("GET /api/driver/pod 200", getRes.status === 200, `status=${getRes.status}`);
    check("GET returns active shipment", getBody?.shipment?.id === shipmentId && getBody?.shipment?.trackingNumber === tracking, `tracking=${getBody?.shipment?.trackingNumber}`);
    check("GET initially has no proof", getBody?.proof === null, `proof=${JSON.stringify(getBody?.proof)}`);
    check("GET returns delivery QR", Boolean(getBody?.qr?.payload), getBody?.qr ? "qr present" : JSON.stringify(getBody?.qr));
    const payload = getBody?.qr?.payload ?? "";
    const [head, sigPart] = payload.split("|");
    check("QR payload is CFV1:<tracking>|<hex8>", head === `CFV1:${tracking}` && /^[0-9a-f]{16}$/.test(sigPart ?? ""), payload);
    const recomputed = createHmac("sha256", process.env.POD_VERIFY_SECRET || process.env.BETTER_AUTH_SECRET).update(tracking).digest("hex").slice(0, 16);
    check("QR signature matches HMAC recomputation", sigPart === recomputed, `got=${sigPart} expected=${recomputed}`);
    check("QR dataUrl is a PNG", Boolean(getBody?.qr?.dataUrl?.startsWith("data:image/png;base64,")), "");

    // ---- negative: POD for a shipment not in the assignment ----------------
    const negRes = await fetch(`${API}/api/driver/pod`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ shipmentId: otherShipmentId, recipientName: "Intruder" }),
    });
    const negBody = await negRes.json();
    check("POD for unassigned shipment rejected (403)", negRes.status === 403, `status=${negRes.status} body=${JSON.stringify(negBody)}`);

    // ---- capture POD -------------------------------------------------------
    const photo = { dataUrl: tinyPng, contentType: "image/png" };
    const podBody = {
      shipmentId,
      recipientName: "Chidi Okafor",
      recipientPhone: "+234 800 000 0000",
      notes: "runtime verification capture",
      photos: [photo],
      signature: tinyPng,
      locationLat: 6.45306,
      locationLng: 3.39583,
    };
    const postRes = await fetch(`${API}/api/driver/pod`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(podBody),
    });
    const postBody = await postRes.json();
    check("POD POST 200", postRes.status === 200, `status=${postRes.status}`);
    check("POD POST ok:true", postBody?.ok === true, JSON.stringify(postBody).slice(0, 200));
    check("POD capturedByName = driver", postBody?.proof?.capturedByName === driverName, `capturedByName=${postBody?.proof?.capturedByName}`);

    // ---- GET again: proof persisted ----------------------------------------
    const getRes2 = await fetch(`${API}/api/driver/pod`, { headers: { cookie } });
    const getBody2 = await getRes2.json();
    const p2 = getBody2?.proof;
    check("GET returns persisted proof", Boolean(p2) && p2?.shipmentId === shipmentId, p2 ? `id=${p2.id}` : "no proof");
    check("proof recipient + note persisted", p2?.recipientName === "Chidi Okafor" && p2?.notes === "runtime verification capture", "");
    check("proof photos array stored", Array.isArray(p2?.photos) && p2.photos[0]?.contentType === "image/png", "");
    check("proof GPS stamped", typeof p2?.locationLat === "number" && typeof p2?.locationLng === "number", `lat=${p2?.locationLat} lng=${p2?.locationLng}`);

    // ---- DB verification ----------------------------------------------------
    const proofs = await sql`SELECT "recipientName", "capturedByName" FROM "ProofOfDelivery" WHERE "shipmentId" = ${shipmentId}`;
    check("DB: ProofOfDelivery row exists", proofs.length === 1 && proofs[0].recipientName === "Chidi Okafor", JSON.stringify(proofs));
    const events = await sql`SELECT "eventType", "description" FROM "ShipmentEvent" WHERE "shipmentId" = ${shipmentId}`;
    const podEvent = events.find((e) => e.eventType === "POD_CAPTURED");
    check("DB: POD_CAPTURED event logged", Boolean(podEvent), podEvent ? podEvent.description : JSON.stringify(events));
    const notifs = await sql`SELECT count(*)::int AS n FROM "Notification" WHERE "organizationId" = ${orgId} AND title LIKE ${"%"+tracking+"%"}`;
    check("DB: notification dispatched to shipment.view members", notifs[0].n >= 1, `count=${notifs[0].n}`);
  } finally {
    // ---- cleanup -------------------------------------------------------------
    for (const id of [shipmentId, otherShipmentId]) {
      await sql`DELETE FROM "Notification" WHERE title LIKE ${"%"+tracking+"%"} AND "organizationId" = ${orgId}`;
      await sql`DELETE FROM "ShipmentEvent" WHERE "shipmentId" = ${id}`;
      await sql`DELETE FROM "EtaPrediction" WHERE "shipmentId" = ${id}`;
      await sql`DELETE FROM "ProofOfDelivery" WHERE "shipmentId" = ${id}`;
      await sql`DELETE FROM "Shipment" WHERE id = ${id}`;
      cleaned.add(id);
    }
    await sql`DELETE FROM "VehicleAssignment" WHERE id = ${assignmentId}`;
    await sql`DELETE FROM "Driver" WHERE id = ${driverId}`;
    if (vehicleCid) await sql`DELETE FROM "Vehicle" WHERE id = ${vehicleId}`;
    for (const id of [...created]) cleaned.add(id);
    console.log(`\ncleanup deleted ${cleaned.size} fixture rows`);
  }

  console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});