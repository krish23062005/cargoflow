/* Seed the "vamos" org with rich demo data so every feature has something to
 * show: vehicles, assignments, routes (incl. border crossing), shipments in
 * every status spread over the last ~90 days, event trails, live tracking
 * points, ETA predictions, notifications + preferences, proof-of-delivery,
 * audit logs and extra members. Raw SQL via @neondatabase/serverless.
 * Temporary helper script — safe to delete after running. */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { neon } = require("@neondatabase/serverless");
const { randomBytes } = require("node:crypto");

const sql = neon(process.env.DATABASE_URL);

const ORG = "cmsp0990e000n38u799wnhfjs"; // vamos
const OWNER = "cmsp082vd000k38u7u002qfxt"; // chintu coder (owner)
const OWNER_MEMBER = "cmsp0998i000o38u7flufc9rg";

const DRIVERS = {
  babatunde: "29859a24-9f68-4f24-94a4-6d860cc06d8f",
  funmilayo: "04198e8c-065d-4b99-aa12-05192b2399ab",
  chiamaka: "8a785817-e729-4ed3-b37c-92cd9cd1391d",
  damilare: "9ace0bbd-f3c3-4b3f-b1d0-b420a660f39d",
};

const NOW = Date.now();
const H = 3600e3;
const D = 24 * H;
const iso = (ms) => new Date(ms).toISOString();
const daysAgo = (d, hour = 9) => iso(NOW - d * D - (12 - hour) * H);
const hoursAgo = (h) => iso(NOW - h * H);
const id = (tag) => `${tag}_${randomBytes(4).toString("hex")}`;

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const jb = (v) => JSON.stringify(v);

// ---- idempotency: wipe any rows this script previously created (our ids use
// short underscore prefixes like vh_/sh_ - nothing else in the DB does).
const TAG_PATTERN = "^(us|me|vh|as|rt|sh|ev|tp|et|nt|np|po|au|in)_.*";

async function clean() {
  for (const [table, byOrg] of [
    ["TrackingPoint", true], ["EtaPrediction", true], ["ProofOfDelivery", true],
    ["NotificationPreference", true], ["Notification", true], ["ShipmentEvent", true],
    ["Shipment", true], ["Route", true], ["VehicleAssignment", true], ["Vehicle", true],
    ["Invitation", true], ["AuditLog", true], ["Member", true],
  ]) {
    const ident = sql.unsafe(`"${table}"`);
    if (byOrg) {
      await sql`DELETE FROM ${ident} WHERE "organizationId" = ${ORG} AND id ~ ${TAG_PATTERN}`;
    } else {
      await sql`DELETE FROM ${ident} WHERE id ~ ${TAG_PATTERN}`;
    }
  }
  // Users have no organizationId - wipe by prefix directly.
  await sql`DELETE FROM "User" WHERE id ~ ${TAG_PATTERN}`;
}

// ---- extra member users (so members page, notifications & reports have people)
const userNaledi = id("us");
const userSipho = id("us");
const memberNaledi = id("me");
const memberSipho = id("me");

async function main() {
  await clean();

  // ---- users + members ---------------------------------------------------
  await sql`INSERT INTO "User" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
    (${userNaledi}, 'Naledi Khumalo', 'naledi@vamosdemo.com', true, ${daysAgo(40)}, ${daysAgo(40)}),
    (${userSipho}, 'Sipho Dlamini', 'sipho@vamosdemo.com', true, ${daysAgo(33)}, ${daysAgo(33)})`;
  await sql`INSERT INTO "Member" (id, "organizationId", "userId", role, "createdAt") VALUES
    (${memberNaledi}, ${ORG}, ${userNaledi}, 'dispatcher', ${daysAgo(40)}),
    (${memberSipho}, ${ORG}, ${userSipho}, 'viewer', ${daysAgo(33)})`;

  // ---- vehicles -----------------------------------------------------------
  const vh = {
    hilux: id("vh"), man: id("vh"), iveco: id("vh"), hino: id("vh"), ranger: id("vh"), cruiser: id("vh"),
  };
  await sql`INSERT INTO "Vehicle"
    (id, "organizationId", "plateNumber", make, model, year, type, status, color, vin, "fuelType", "fuelCapacity", "insuranceCompany", "insuranceExpiry", "lastServiceAt", "nextServiceAt", notes, "createdAt", "updatedAt") VALUES
    (${vh.hilux}, ${ORG}, 'BF 32 GP', 'Toyota', 'Hilux 2.4 GD-6', 2022, 'PICKUP', 'IN_USE', 'White', 'AHTFR29G301234567', 'DIESEL', 80, 'Old Mutual', ${iso(NOW + 300 * D)}, ${daysAgo(60)}, ${daysAgo(-90)}, 'Daily depot run + local deliveries', ${daysAgo(90)}, ${daysAgo(90)}),
    (${vh.man}, ${ORG}, 'LB 77 MP', 'MAN', 'TGS 26.440', 2021, 'TRUCK', 'IN_TRANSIT', 'Red', 'WMA26ZZZ7LT123456', 'DIESEL', 400, 'Santam', ${iso(NOW + 220 * D)}, ${daysAgo(30)}, ${daysAgo(-60)}, 'Long-haul N1/N3 truck', ${daysAgo(95)}, ${daysAgo(95)}),
    (${vh.iveco}, ${ORG}, 'CF 10 GP', 'Iveco', 'Daily 35S14', 2023, 'VAN', 'AVAILABLE', 'Silver', 'ZCFC2353505123456', 'DIESEL', 100, 'MiWay', ${iso(NOW + 400 * D)}, ${daysAgo(20)}, ${daysAgo(-70)}, '', ${daysAgo(88)}, ${daysAgo(88)}),
    (${vh.hino}, ${ORG}, 'CY 54 NW', 'Hino', '500 Series', 2019, 'TRUCK', 'MAINTENANCE', 'Blue', 'JHFK600C5KX123456', 'DIESEL', 300, 'Hollard', ${iso(NOW + 120 * D)}, ${daysAgo(10)}, ${daysAgo(-14)}, 'In for gearbox service', ${daysAgo(120)}, ${daysAgo(120)}),
    (${vh.ranger}, ${ORG}, 'BN 88 KZN', 'Ford', 'Ranger 2.0 XL', 2021, 'PICKUP', 'AVAILABLE', 'Grey', 'WFC0XXKZG9E123456', 'DIESEL', 80, 'Old Mutual', ${iso(NOW + 180 * D)}, ${daysAgo(75)}, ${daysAgo(-105)}, '', ${daysAgo(100)}, ${daysAgo(100)}),
    (${vh.cruiser}, ${ORG}, 'GP 21 CA', 'Toyota', 'Land Cruiser 79', 2020, 'PICKUP', 'AVAILABLE', 'Green', 'JTEBU71J600123456', 'DIESEL', 130, 'Santam', ${iso(NOW + 160 * D)}, ${daysAgo(45)}, ${daysAgo(-135)}, 'Backup / senior staff', ${daysAgo(110)}, ${daysAgo(110)})`;

  // ---- assignments ---------------------------------------------------------
  const asn = { a1: id("as"), a2: id("as"), a3: id("as"), a4: id("as") };
  await sql`INSERT INTO "VehicleAssignment"
    (id, "organizationId", "vehicleId", "driverId", status, "startDate", "endDate", notes, "createdAt", "updatedAt") VALUES
    (${asn.a1}, ${ORG}, ${vh.man}, ${DRIVERS.chiamaka}, 'ACTIVE', ${daysAgo(18, 7)}, NULL, 'Durban run - live', ${daysAgo(18)}, ${daysAgo(18)}),
    (${asn.a2}, ${ORG}, ${vh.hilux}, ${DRIVERS.babatunde}, 'ACTIVE', ${daysAgo(60, 7)}, NULL, 'Depot + local', ${daysAgo(60)}, ${daysAgo(60)}),
    (${asn.a3}, ${ORG}, ${vh.ranger}, ${DRIVERS.damilare}, 'ENDED', ${daysAgo(75, 7)}, ${daysAgo(45, 18)}, 'Completed May delivery', ${daysAgo(75)}, ${daysAgo(45)}),
    (${asn.a4}, ${ORG}, ${vh.hino}, ${DRIVERS.damilare}, 'ENDED', ${daysAgo(45, 7)}, ${daysAgo(35, 18)}, 'Short loan run', ${daysAgo(45)}, ${daysAgo(35)})`;

  // ---- routes --------------------------------------------------------------
  const r = {
    r1: id("rt"), r2: id("rt"), r3: id("rt"), r4: id("rt"),
    r5: id("rt"), r6: id("rt"), r7: id("rt"), r8: id("rt"),
  };
  const routes = [
    { key: "r1", name: "JHB → Durban (N3)", km: 570, min: 420, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -28.2728, lng: 29.1294, name: "Harrismith Rest Stop", type: "REST_STOP" },
      { lat: -28.3769, lng: 29.3829, name: "Van Reenen Pass", type: "CHECKPOINT" },
      { lat: -29.8587, lng: 31.0218, name: "Durban Harbour, Berth 204", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-26.5041,28.3531],[-27.0302,28.6106],[-28.2728,29.1294],[-28.3769,29.3829],[-28.5538,29.7807],[-29.8587,31.0218]] },
    { key: "r2", name: "JHB → Cape Town (N1)", km: 1400, min: 840, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -29.0852, lng: 26.1596, name: "Bloemfontein Fuel Stop", type: "FUEL_STOP" },
      { lat: -32.3567, lng: 22.5735, name: "Beaufort West Checkpoint", type: "CHECKPOINT" },
      { lat: -33.9249, lng: 18.4241, name: "Cape Town Container Port", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-28.1888,26.7501],[-29.0852,26.1596],[-31.4051,23.3585],[-32.3567,22.5735],[-33.9249,18.4241]] },
    { key: "r3", name: "JHB → Polokwane (N1)", km: 330, min: 240, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -25.7479, lng: 28.2293, name: "Pretoria Hub", type: "CHECKPOINT" },
      { lat: -23.8962, lng: 29.4486, name: "Polokwane Build Mart", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-25.7479,28.2293],[-24.9044,28.5794],[-23.8962,29.4486]] },
    { key: "r4", name: "Durban → East London (N2)", km: 650, min: 480, wps: [
      { lat: -29.8587, lng: 31.0218, name: "Durban Harbour", type: "PICKUP" },
      { lat: -31.589, lng: 28.7843, name: "Mthatha Checkpoint", type: "CHECKPOINT" },
      { lat: -33.0153, lng: 27.9116, name: "East London Harbour", type: "DROPOFF" },
    ], geo: [[-29.8587,31.0218],[-30.5595,30.4775],[-31.589,28.7843],[-32.9821,28.0477],[-33.0153,27.9116]] },
    { key: "r5", name: "JHB → Cape Town (express)", km: 1415, min: 850, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -31.4051, lng: 23.3585, name: "Colesberg Checkpoint", type: "CHECKPOINT" },
      { lat: -33.9249, lng: 18.4241, name: "Cape Town Container Port", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-28.1888,26.7501],[-30.6996,25.51],[-31.4051,23.3585],[-33.9249,18.4241]] },
    { key: "r6", name: "JHB → Gaborone (N4)", km: 380, min: 330, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -25.8102, lng: 25.9669, name: "Skilpadshek Border", type: "BORDER_CROSSING" },
      { lat: -24.6282, lng: 25.9231, name: "Gaborone Distribution Centre", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-26.1372,27.0101],[-25.8102,25.9669],[-25.2845,25.6123],[-24.6282,25.9231]] },
    { key: "r7", name: "Cape Town → Port Elizabeth", km: 760, min: 540, wps: [
      { lat: -33.9249, lng: 18.4241, name: "Cape Town Container Port", type: "PICKUP" },
      { lat: -33.9881, lng: 22.4522, name: "George Fuel Stop", type: "FUEL_STOP" },
      { lat: -33.9608, lng: 25.6022, name: "PE Terminal, Ngqura", type: "DROPOFF" },
    ], geo: [[-33.9249,18.4241],[-34.09,21.65],[-33.9881,22.4522],[-33.9982,23.8782],[-33.9608,25.6022]] },
    { key: "r8", name: "JHB → Durban (N3 direct)", km: 568, min: 415, wps: [
      { lat: -26.2041, lng: 28.0473, name: "Vamos Depot, City Deep", type: "PICKUP" },
      { lat: -28.3769, lng: 29.3829, name: "Van Reenen Pass", type: "CHECKPOINT" },
      { lat: -29.8587, lng: 31.0218, name: "Durban Harbour, Berth 204", type: "DROPOFF" },
    ], geo: [[-26.2041,28.0473],[-26.5041,28.3531],[-27.0302,28.6106],[-28.3769,29.3829],[-28.5538,29.7807],[-29.8587,31.0218]] },
  ];
  for (const rt of routes) {
    await sql`INSERT INTO "Route"
      (id, "organizationId", name, waypoints, "totalDistanceKm", "estimatedDurationMin", geometry, notes, "createdAt", "updatedAt") VALUES
      (${r[rt.key]}, ${ORG}, ${rt.name}, ${jb(rt.wps)}, ${rt.km}, ${rt.min}, ${jb(rt.geo)}, 'Seeded demo route', ${daysAgo(120)}, ${daysAgo(120)})`;
  }

  // ---- shipments ------------------------------------------------------------
  const sh = {
    k9ld: id("sh"), q3mn: id("sh"), e7vb: id("sh"), t7wb: id("sh"),
    r2pf: id("sh"), w9hd: id("sh"), b4jk: id("sh"), g6xz: id("sh"),
    c8yv: id("sh"), n3rt: id("sh"), d5qw: id("sh"), h1jk: id("sh"),
    m6pl: id("sh"), z4qs: id("sh"),
  };
  const shipments = [
    // [key, tracking, status, customer, cargoType, origin, dest, latA, lngA, latB, lngB, createdAtDaysAgo, estDays, delDays, routeKey, assignmentKey]
    ["k9ld", "CF-VA-20260512-K9LD", "DELIVERED", "FreshFarm Distributors", "PERISHABLE", "14 Marble St, Johannesburg", "Berth 204, Durban Harbour", -26.2041, 28.0473, -29.8587, 31.0218, 74, 1, 72, "r8", "a3"],
    ["q3mn", "CF-VA-20260522-Q3MN", "DELIVERED", "Apex Manufacturing", "GENERAL", "City Deep Depot, Johannesburg", "Container Port, Cape Town", -26.2041, 28.0473, -33.9249, 18.4241, 64, 4, 62, "r5", null],
    ["e7vb", "CF-VA-20260530-E7VB", "CANCELLED", "Blue River Traders", "FRAGILE", "Rosebank, Johannesburg", "Durban Central", -26.2041, 28.0473, -29.8587, 31.0218, 56, 2, null, null, null],
    ["t7wb", "CF-VA-20260605-T7WB", "DELIVERED", "Eastern Cape Mills", "GENERAL", "Durban Harbour", "East London Harbour", -29.8587, 31.0218, -33.0153, 27.9116, 50, 3, 48, "r4", null],
    ["r2pf", "CF-VA-20260618-R2PF", "DELIVERED", "Highveld Retail Group", "GENERAL", "City Deep Depot, Johannesburg", "Polokwane", -26.2041, 28.0473, -23.8962, 29.4486, 38, 2, 37, null, null],
    ["w9hd", "CF-VA-20260702-W9HD", "DELIVERED", "Karoo Fresh Produce", "PERISHABLE", "Bapsfontein, Johannesburg", "Cape Town Fresh Market", -26.2041, 28.0473, -33.9249, 18.4241, 25, 4, 24, null, null],
    ["b4jk", "CF-VA-20260715-B4JK", "DELIVERED", "Garden Route Foods", "LIQUID", "Cape Town Container Port", "PE Terminal, Ngqura", -33.9249, 18.4241, -33.9608, 25.6022, 20, 3, 19, "r7", null],
    ["g6xz", "CF-VA-20260728-G6XZ", "DELIVERED", "Botswana Wholesale Co", "GENERAL", "City Deep Depot, Johannesburg", "Gaborone Distribution Centre", -26.2041, 28.0473, -24.6282, 25.9231, 9, 3, 8, "r6", null],
    ["c8yv", "CF-VA-20260802-C8YV", "IN_TRANSIT", "Durban Harbour Logistics", "GENERAL", "City Deep Depot, Johannesburg", "Berth 204, Durban Harbour", -26.2041, 28.0473, -29.8587, 31.0218, 5, 3, null, "r1", "a1"],
    ["n3rt", "CF-VA-20260804-N3RT", "PICKED_UP", "Limpopo Agri Co-op", "HAZARDOUS", "Seedsco, Pretoria", "Polokwane Agri Park", -25.7479, 28.2293, -23.8962, 29.4486, 3, 2, null, null, null],
    ["d5qw", "CF-VA-20260806-D5QW", "AT_CHECKPOINT", "Cape Clothing Works", "GENERAL", "City Deep Depot, Johannesburg", "Cape Town Container Port", -26.2041, 28.0473, -33.9249, 18.4241, 2, 4, null, "r2", null],
    ["h1jk", "CF-VA-20260809-H1JK", "PENDING_PICKUP", "Polokwane Build Mart", "OVERSIZED", "City Deep Depot, Johannesburg", "Polokwane Build Mart", -26.2041, 28.0473, -23.8962, 29.4486, 1, 2, null, "r3", "a2"],
    ["m6pl", "CF-VA-20260811-M6PL", "PENDING_PICKUP", "Two Rivers Mining", "LIQUID", "City Deep Depot, Johannesburg", "Durban Harbour", -26.2041, 28.0473, -29.8587, 31.0218, 0, 3, null, null, null],
    ["z4qs", "CF-VA-20260812-Z4QS", "PENDING_PICKUP", "City Centre Books", "DOCUMENTS", "Braamfontein, Johannesburg", "Bloemfontein", -26.2041, 28.0473, -29.0852, 26.1596, 0, 1, null, null, null],
  ];
  for (const s of shipments) {
    const [key, tracking, status, customer, cargoType, origin, dest, latA, lngA, latB, lngB, createdD, estD, delD, routeKey, asnKey] = s;
    const created = daysAgo(createdD, 8);
    const estimated = delD != null ? daysAgo(delD - estD, 18) : daysAgo(createdD - estD, 18);
    const delivered = delD != null ? daysAgo(delD, 17) : null;
    const weight = (0.2 + Math.random() * 4.8).toFixed(1);
    const value = Math.round(80000 + Math.random() * 600000);
    await sql`INSERT INTO "Shipment"
      (id, "organizationId", "trackingNumber", status, "customerName", "customerPhone", "customerEmail",
       "originAddress", "originCity", "originLat", "originLng",
       "destinationAddress", "destinationCity", "destinationLat", "destinationLng",
       "cargoType", "cargoDescription", "weightKg", "dimensions", "declaredValue",
       "requestedPickupAt", "estimatedDeliverAt", "actualDeliveredAt", notes,
       "assignmentId", "routeId", "createdAt", "updatedAt") VALUES
      (${sh[key]}, ${ORG}, ${tracking}, ${status}, ${customer}, ${`+27${Math.floor(Math.random() * 9e8) + 1e8}`}, ${customer.toLowerCase().replace(/[^a-z0-9]+/g, ".") + "@example.com"},
       ${origin}, ${origin.split(",").pop()?.trim() ?? "Johannesburg"}, ${latA}, ${lngA},
       ${dest}, ${dest.split(",").pop()?.trim() ?? "Durban"}, ${latB}, ${lngB},
       ${cargoType}, ${status === "CANCELLED" ? "Order cancelled by customer before pickup" : "Seeded demo cargo"}, ${weight}, ${"3.5 x 2.2 x 2.4 m"}, ${value},
       ${daysAgo(createdD - 1, 8)}, ${estimated}, ${delivered}, NULL,
       ${asnKey ? asn[asnKey] : null}, ${routeKey ? r[routeKey] : null}, ${created}, ${created})`;
    if (routeKey) {
      await sql`UPDATE "Route" SET "shipmentId" = ${sh[key]} WHERE id = ${r[routeKey]}`;
    }
  }

  // ---- shipment events ------------------------------------------------------
  const ev = async (shipmentKey, eventType, description, created, location) => {
    await sql`INSERT INTO "ShipmentEvent"
      (id, "organizationId", "shipmentId", "eventType", description, location, latitude, longitude, "createdById", "createdAt") VALUES
      (${id("ev")}, ${ORG}, ${sh[shipmentKey]}, ${eventType}, ${description}, ${location ?? null}, NULL, NULL, ${OWNER}, ${created})`;
  };
  // Live shipment trail (C8YV)
  await ev("c8yv", "ASSIGNED", "Shipment assigned to Chiamaka Eze · MAN TGS 26.440 (LB 77 MP)", daysAgo(5, 9), "City Deep, Johannesburg");
  await ev("c8yv", "STATUS_CHANGED", "Status changed from Pending pickup to Picked up · by driver Chiamaka Eze", daysAgo(4, 10), "City Deep, Johannesburg");
  await ev("c8yv", "STATUS_CHANGED", "Status changed from Picked up to In transit · by driver Chiamaka Eze", daysAgo(3, 7), "On N3 near Villiers");
  await ev("c8yv", "CHECKPOINT", "Checked in at Harrismith Rest Stop", hoursAgo(6), "Harrismith");
  // AT_CHECKPOINT trail (D5QW)
  await ev("d5qw", "STATUS_CHANGED", "Status changed from Pending pickup to Picked up", daysAgo(2, 9), "City Deep, Johannesburg");
  await ev("d5qw", "STATUS_CHANGED", "Status changed from Picked up to In transit", daysAgo(1, 7), "On N1 near Bloemfontein");
  await ev("d5qw", "STATUS_CHANGED", "Status changed from In transit to At checkpoint", hoursAgo(5), "Beaufort West");
  await ev("d5qw", "CHECKPOINT", "Vehicle stopped at Beaufort West checkpoint", hoursAgo(4), "Beaufort West");
  // PENDING/PICKED trails
  await ev("h1jk", "ASSIGNED", "Shipment assigned to Babatunde Adeyemi · Toyota Hilux (BF 32 GP)", daysAgo(1, 9), "City Deep, Johannesburg");
  await ev("n3rt", "STATUS_CHANGED", "Status changed from Pending pickup to Picked up", daysAgo(1, 11), "Seedsco, Pretoria");
  // Delivered trails
  await ev("k9ld", "STATUS_CHANGED", "Status changed from In transit to Delivered", daysAgo(72, 17), "Durban Harbour");
  await ev("k9ld", "POD_CAPTURED", "Proof of delivery captured (signature + 1 photo)", daysAgo(72, 17), "Durban Harbour");
  await ev("t7wb", "STATUS_CHANGED", "Status changed from In transit to Delivered", daysAgo(48, 16), "East London Harbour");
  await ev("g6xz", "STATUS_CHANGED", "Status changed from In transit to Delivered", daysAgo(8, 15), "Gaborone Distribution Centre");
  await ev("g6xz", "POD_CAPTURED", "Proof of delivery captured (signature + 2 photos)", daysAgo(8, 15), "Gaborone Distribution Centre");
  await ev("q3mn", "STATUS_CHANGED", "Status changed from In transit to Delivered", daysAgo(62, 18), "Cape Town Container Port");
  await ev("b4jk", "STATUS_CHANGED", "Status changed from In transit to Delivered", daysAgo(19, 17), "PE Terminal, Ngqura");
  await ev("e7vb", "STATUS_CHANGED", "Status changed from Pending pickup to Cancelled", daysAgo(55, 14), "City Deep, Johannesburg");

  // ---- tracking points (live truck + idle depot + historical) --------------
  const lerp = (a, b, t) => a + (b - a) * t;
  const jitter = (v, amp) => v + (Math.random() - 0.5) * amp;
  const routeGeo = routes.find((x) => x.key === "r1").geo;
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const seg = Math.min(routeGeo.length - 2, Math.floor(t * (routeGeo.length - 1)));
    const local = t * (routeGeo.length - 1) - seg;
    const lat = jitter(lerp(routeGeo[seg][0], routeGeo[seg + 1][0], local), 0.004);
    const lng = jitter(lerp(routeGeo[seg][1], routeGeo[seg + 1][1], local), 0.004);
    const speed = i < 3 ? 0 : 55 + Math.random() * 40;
    await sql`INSERT INTO "TrackingPoint"
      (id, "organizationId", "vehicleId", lat, lng, "speedKmh", "headingDeg", "accuracyM", source, "recordedAt", "createdAt") VALUES
      (${id("tp")}, ${ORG}, ${vh.man}, ${+lat.toFixed(6)}, ${+lng.toFixed(6)}, ${+speed.toFixed(1)}, ${Math.round(lerp(150, 30, t))}, 8, 'PWA', ${hoursAgo(30 - i * 0.96)}, ${hoursAgo(30 - i * 0.96)})`;
  }
  for (let i = 0; i < 8; i++) {
    await sql`INSERT INTO "TrackingPoint"
      (id, "organizationId", "vehicleId", lat, lng, "speedKmh", "headingDeg", "accuracyM", source, "recordedAt", "createdAt") VALUES
      (${id("tp")}, ${ORG}, ${vh.hilux}, ${(-26.2041 + (Math.random() - 0.5) * 0.01).toFixed(6)}, ${(28.0473 + (Math.random() - 0.5) * 0.01).toFixed(6)}, ${(Math.random() * 3).toFixed(1)}, 0, 6, 'PWA', ${hoursAgo(24 - i * 3)}, ${hoursAgo(24 - i * 3)})`;
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const seg = Math.min(routeGeo.length - 2, Math.floor(t * (routeGeo.length - 1)));
    const local = t * (routeGeo.length - 1) - seg;
    await sql`INSERT INTO "TrackingPoint"
      (id, "organizationId", "vehicleId", lat, lng, "speedKmh", "headingDeg", "accuracyM", source, "recordedAt", "createdAt") VALUES
      (${id("tp")}, ${ORG}, ${vh.ranger}, ${+jitter(lerp(routeGeo[seg][0], routeGeo[seg + 1][0], local), 0.004).toFixed(6)}, ${+jitter(lerp(routeGeo[seg][1], routeGeo[seg + 1][1], local), 0.004).toFixed(6)}, ${+(60 + Math.random() * 30).toFixed(1)}, ${Math.round(lerp(150, 30, t))}, 9, 'PWA', ${daysAgo(74, 8 + i * 0.8)}, ${daysAgo(74, 8 + i * 0.8)})`;
  }

  // ---- ETA predictions (live shipment) -------------------------------------
  await sql`INSERT INTO "EtaPrediction"
    (id, "organizationId", "shipmentId", "vehicleId", status, "predictedAt", "remainingKm", "predictedMinutes", "etaAt", "speedUsedKmh", "isDelayed") VALUES
    (${id("et")}, ${ORG}, ${sh.c8yv}, ${vh.man}, 'IN_TRANSIT', ${hoursAgo(8)}, 512, 385, ${iso(NOW + 385 * 60e3)}, 80, false),
    (${id("et")}, ${ORG}, ${sh.c8yv}, ${vh.man}, 'IN_TRANSIT', ${hoursAgo(4)}, 342, 262, ${iso(NOW + 262 * 60e3)}, 78, false),
    (${id("et")}, ${ORG}, ${sh.c8yv}, ${vh.man}, 'IN_TRANSIT', ${hoursAgo(1)}, 241, 188, ${iso(NOW + 188 * 60e3)}, 77, false)`;

  // ---- notifications + preferences -----------------------------------------
  await sql`INSERT INTO "Notification"
    (id, "organizationId", "userId", type, title, body, link, read, channel, "createdAt") VALUES
    (${id("nt")}, ${ORG}, ${OWNER}, 'SHIPMENT_STATUS_CHANGE', 'Shipment CF-VA-20260802-C8YV is now In transit', 'Status changed from Picked up to In transit · by driver Chiamaka Eze', ${`/shipments/${sh.c8yv}`}, false, 'IN_APP', ${daysAgo(3, 7)}),
    (${id("nt")}, ${ORG}, ${OWNER}, 'SHIPMENT_STATUS_CHANGE', 'Shipment CF-VA-20260715-B4JK was delivered', 'Status changed from In transit to Delivered', ${`/shipments/${sh.b4jk}`}, true, 'IN_APP', ${daysAgo(19, 17)}),
    (${id("nt")}, ${ORG}, ${OWNER}, 'DRIVER_ALERT', 'Licence expiring: Damilare Johnson', 'Damilare Johnson''s licence expires on 19 Aug 2026. Renew it soon.', ${`/drivers/${DRIVERS.damilare}`}, false, 'IN_APP', ${daysAgo(1, 9)}),
    (${id("nt")}, ${ORG}, ${OWNER}, 'SYSTEM', 'Welcome to CargoFlow vamos', 'Your fleet workspace is ready. Invite your team and start dispatching.', NULL, true, 'IN_APP', ${daysAgo(40, 10)}),
    (${id("nt")}, ${ORG}, ${userNaledi}, 'SHIPMENT_STATUS_CHANGE', 'Shipment CF-VA-20260802-C8YV is now In transit', 'Status changed from Picked up to In transit', ${`/shipments/${sh.c8yv}`}, false, 'IN_APP', ${daysAgo(3, 7)}),
    (${id("nt")}, ${ORG}, ${userNaledi}, 'VEHICLE_ALERT', 'MAN TGS 26.440 running late', 'LB 77 MP is behind schedule on the Durban run - ETA pushed to later today', ${`/fleet/${vh.man}`}, false, 'IN_APP', ${hoursAgo(2)}),
    (${id("nt")}, ${ORG}, ${userNaledi}, 'DRIVER_ALERT', 'Licence expired: Funmilayo Ojo', 'Funmilayo Ojo''s licence expired in December 2024. Do not assign until renewed.', ${`/drivers/${DRIVERS.funmilayo}`}, true, 'IN_APP', ${daysAgo(12, 11)}),
    (${id("nt")}, ${ORG}, ${userSipho}, 'SHIPMENT_STATUS_CHANGE', 'Shipment CF-VA-20260806-D5QW is at a checkpoint', 'Status changed from In transit to At checkpoint - Beaufort West', ${`/shipments/${sh.d5qw}`}, false, 'IN_APP', ${hoursAgo(5)}),
    (${id("nt")}, ${ORG}, ${userSipho}, 'SYSTEM', 'You were invited to vamos', 'Sipho Dlamini joined as a viewer', NULL, true, 'IN_APP', ${daysAgo(33, 12)})`;
  await sql`INSERT INTO "NotificationPreference"
    (id, "organizationId", "userId", "shipmentStatus", "vehicleAlert", "driverAlert", "systemAlert", email, sms, "createdAt", "updatedAt") VALUES
    (${id("np")}, ${ORG}, ${OWNER}, true, true, true, true, false, false, ${daysAgo(40)}, ${daysAgo(40)}),
    (${id("np")}, ${ORG}, ${userNaledi}, true, true, true, true, true, true, ${daysAgo(40)}, ${daysAgo(40)}),
    (${id("np")}, ${ORG}, ${userSipho}, true, false, true, true, false, false, ${daysAgo(33)}, ${daysAgo(33)})`;

  // ---- proof of delivery -----------------------------------------------------
  await sql`INSERT INTO "ProofOfDelivery"
    (id, "organizationId", "shipmentId", photos, signature, "recipientName", "recipientPhone", notes, "locationLat", "locationLng", "capturedByName", "capturedAt") VALUES
    (${id("po")}, ${ORG}, ${sh.k9ld}, ${jb([{ kind: "photo", dataUrl: tinyPng }, { kind: "photo", dataUrl: tinyPng }])}, ${tinyPng}, 'Thabo Mokoena', '+27821234567', 'Signed at gate 4', -29.8587, 31.0218, 'Damilare Johnson', ${daysAgo(72, 17)}),
    (${id("po")}, ${ORG}, ${sh.t7wb}, ${jb([{ kind: "photo", dataUrl: tinyPng }])}, ${tinyPng}, 'Lindelwa Nkosi', '+27439211234', 'Accepted at warehouse', -33.0153, 27.9116, 'Babatunde Adeyemi', ${daysAgo(48, 16)}),
    (${id("po")}, ${ORG}, ${sh.g6xz}, ${jb([{ kind: "photo", dataUrl: tinyPng }, { kind: "photo", dataUrl: tinyPng }])}, ${tinyPng}, 'Kabelo Moilwa', '+26771234567', 'Customs cleared', -24.6282, 25.9231, 'Chiamaka Eze', ${daysAgo(8, 15)})`;

  // ---- audit log ------------------------------------------------------------
  const audit = async (resource, action, resourceId, metadata) => {
    await sql`INSERT INTO "AuditLog"
      (id, "organizationId", "userId", action, resource, "resourceId", metadata, "ipAddress", "userAgent", "createdAt") VALUES
      (${id("au")}, ${ORG}, ${OWNER}, ${action}, ${resource}, ${resourceId ?? null}, ${jb(metadata ?? {})}, '41.216.202.1', 'CargoFlow/1.0 (demo seed)', ${daysAgo(Math.floor(Math.random() * 60), 10)})`;
  };
  await audit("vehicle", "CREATE", vh.man, { vehicleId: vh.man, plateNumber: "LB 77 MP" });
  await audit("vehicle", "CREATE", vh.hilux, { vehicleId: vh.hilux, plateNumber: "BF 32 GP" });
  await audit("driver", "UPDATE", DRIVERS.damilare, { field: "licenseExpiry" });
  await audit("shipment", "CREATE", sh.c8yv, { trackingNumber: "CF-VA-20260802-C8YV" });
  await audit("shipment", "STATUS_CHANGE", sh.c8yv, { from: "PICKED_UP", to: "IN_TRANSIT" });
  await audit("member", "INVITE", userSipho, { email: "sipho@vamosdemo.com", role: "viewer" });
  await audit("shipment", "POD_CAPTURED", sh.k9ld, { trackingNumber: "CF-VA-20260512-K9LD" });

  // ---- invitation -----------------------------------------------------------
  await sql`INSERT INTO "Invitation"
    (id, "organizationId", email, role, status, "expiresAt", "inviterId", "createdAt") VALUES
    (${id("in")}, ${ORG}, 'operations@vamosdemo.com', 'dispatcher', 'pending', ${iso(NOW + 7 * D)}, ${OWNER}, ${daysAgo(2, 9)})`;

  // ---- summary ---------------------------------------------------------------
  const sum = await sql`
    SELECT
      (SELECT count(*) FROM "Vehicle" WHERE "organizationId" = ${ORG}) AS vehicles,
      (SELECT count(*) FROM "VehicleAssignment" WHERE "organizationId" = ${ORG}) AS assignments,
      (SELECT count(*) FROM "Shipment" WHERE "organizationId" = ${ORG}) AS shipments,
      (SELECT count(*) FROM "Route" WHERE "organizationId" = ${ORG}) AS routes,
      (SELECT count(*) FROM "TrackingPoint" WHERE "organizationId" = ${ORG}) AS tracking_points,
      (SELECT count(*) FROM "Notification" WHERE "organizationId" = ${ORG}) AS notifications,
      (SELECT count(*) FROM "NotificationPreference" WHERE "organizationId" = ${ORG}) AS notif_prefs,
      (SELECT count(*) FROM "AuditLog" WHERE "organizationId" = ${ORG}) AS audit_logs,
      (SELECT count(*) FROM "ProofOfDelivery" WHERE "organizationId" = ${ORG}) AS pods,
      (SELECT count(*) FROM "EtaPrediction" WHERE "organizationId" = ${ORG}) AS etas,
      (SELECT count(*) FROM "ShipmentEvent" WHERE "organizationId" = ${ORG}) AS events,
      (SELECT count(*) FROM "Member" WHERE "organizationId" = ${ORG}) AS members,
      (SELECT count(*) FROM "Invitation" WHERE "organizationId" = ${ORG}) AS invitations`;
  console.log("VAMOS SEED COMPLETE:", JSON.stringify(sum[0], null, 1));
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});