import { createAccessControl } from "better-auth/plugins/access";

/**
 * Access control statement + role definitions, shared between the server
 * auth config and the client auth plugin so role types match everywhere.
 */
export const ac = createAccessControl({
  organization: ["create", "read", "update", "delete", "switch"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  fleet: ["create", "read", "update", "delete"],
  driver: ["create", "read", "update", "delete"],
  shipment: ["create", "read", "update", "delete"],
  tracking: ["read"],
  report: ["read"],
  audit: ["read"],
});

const owner = ac.newRole({
  organization: ["create", "read", "update", "delete", "switch"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  fleet: ["create", "read", "update", "delete"],
  driver: ["create", "read", "update", "delete"],
  shipment: ["create", "read", "update", "delete"],
  tracking: ["read"],
  report: ["read"],
  audit: ["read"],
});

const admin = ac.newRole({
  organization: ["read", "update", "switch"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  fleet: ["create", "read", "update", "delete"],
  driver: ["create", "read", "update", "delete"],
  shipment: ["create", "read", "update", "delete"],
  tracking: ["read"],
  report: ["read"],
  audit: ["read"],
});

const dispatcher = ac.newRole({
  organization: ["read", "switch"],
  member: ["read"],
  fleet: ["read", "update"],
  driver: ["read", "update"],
  shipment: ["create", "read", "update"],
  tracking: ["read"],
});

const viewer = ac.newRole({
  organization: ["read", "switch"],
  fleet: ["read"],
  driver: ["read"],
  shipment: ["read"],
  tracking: ["read"],
  report: ["read"],
});

const driver = ac.newRole({
  organization: ["read", "switch"],
  fleet: ["read"],
  shipment: ["read", "update"],
  tracking: ["read"],
});

export const roles = { owner, admin, dispatcher, viewer, driver };
