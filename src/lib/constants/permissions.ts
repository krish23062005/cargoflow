/**
 * Role hierarchy and permission matrix.
 *
 * Kept client-safe so UI components can gate actions without a round trip.
 * Server-side enforcement lives in the tRPC `requirePermission` middleware.
 */
export const ROLE_HIERARCHY = [
  "owner",
  "admin",
  "dispatcher",
  "viewer",
  "driver",
] as const;

export type OrgRole = (typeof ROLE_HIERARCHY)[number];

export const ORG_ROLES: { value: OrgRole; label: string; description: string }[] = [
  {
    value: "owner",
    label: "Owner",
    description: "Full control, including deleting the organization",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Manages org, members, fleet and shipments",
  },
  {
    value: "dispatcher",
    label: "Dispatcher",
    description: "Manages fleet, drivers and shipment status",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to fleet, shipments and reports",
  },
  {
    value: "driver",
    label: "Driver",
    description: "Sees only their own assignments and shipments",
  },
];

export type Permission =
  | "organization.manage"
  | "member.invite"
  | "member.update_role"
  | "member.remove"
  | "fleet.manage"
  | "fleet.view"
  | "driver.manage"
  | "driver.view"
  | "shipment.create"
  | "shipment.view"
  | "shipment.update_status"
  | "route.manage"
  | "route.view"
  | "tracking.view"
  | "report.view"
  | "audit.view";

const ALL: Permission[] = [
  "organization.manage",
  "member.invite",
  "member.update_role",
  "member.remove",
  "fleet.manage",
  "fleet.view",
  "driver.manage",
  "driver.view",
  "shipment.create",
  "shipment.view",
  "shipment.update_status",
  "route.manage",
  "route.view",
  "tracking.view",
  "report.view",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: ALL,
  admin: ALL,
  dispatcher: [
    "fleet.manage",
    "fleet.view",
    "driver.manage",
    "driver.view",
    "shipment.create",
    "shipment.view",
    "shipment.update_status",
    "route.manage",
    "route.view",
    "tracking.view",
    "report.view",
  ],
  viewer: ["fleet.view", "shipment.view", "route.view", "tracking.view", "report.view"],
  driver: ["shipment.view", "shipment.update_status", "tracking.view"],
};

export function isRoleAtLeast(role: string, minimum: OrgRole) {
  const index = ROLE_HIERARCHY.indexOf(role as OrgRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minimum);
  if (index === -1) return false;
  return index <= minIndex;
}

export function hasPermission(role: string, permission: Permission) {
  return (ROLE_PERMISSIONS[role as OrgRole] ?? []).includes(permission);
}

export function canManageRole(currentRole: string, targetRole: string) {
  return (
    isRoleAtLeast(currentRole, "admin") &&
    isRoleAtLeast(targetRole, currentRole as OrgRole)
  );
}
