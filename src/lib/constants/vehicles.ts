export const VEHICLE_TYPES = [
  "TRUCK",
  "VAN",
  "PICKUP",
  "TRAILER",
  "TANKER",
  "MOTORCYCLE",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPES_META: {
  value: VehicleType;
  label: string;
  description: string;
}[] = [
  { value: "TRUCK", label: "Truck", description: "Heavy goods haulage" },
  { value: "VAN", label: "Van", description: "Light cargo and parcels" },
  { value: "PICKUP", label: "Pickup", description: "Utility pickup trucks" },
  { value: "TRAILER", label: "Trailer", description: "Articulated trailers" },
  { value: "TANKER", label: "Tanker", description: "Liquid or fuel tankers" },
  { value: "MOTORCYCLE", label: "Motorcycle", description: "Last-mile delivery bikes" },
];

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "IN_USE",
  "IN_TRANSIT",
  "MAINTENANCE",
  "DECOMMISSIONED",
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_META: {
  value: VehicleStatus;
  label: string;
  description: string;
}[] = [
  { value: "AVAILABLE", label: "Available", description: "Ready for assignment" },
  { value: "IN_USE", label: "In use", description: "Assigned to a driver" },
  { value: "IN_TRANSIT", label: "In transit", description: "Currently on the road" },
  { value: "MAINTENANCE", label: "Maintenance", description: "Being serviced or repaired" },
  { value: "DECOMMISSIONED", label: "Decommissioned", description: "Retired from service" },
];

export const FUEL_TYPES = ["DIESEL", "PETROL", "ELECTRIC", "CNG", "HYBRID"] as const;

export const FUEL_TYPE_META: { value: string; label: string }[] = [
  { value: "DIESEL", label: "Diesel" },
  { value: "PETROL", label: "Petrol" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "CNG", label: "CNG" },
  { value: "HYBRID", label: "Hybrid" },
];

export const getVehicleTypeLabel = (value: string) =>
  VEHICLE_TYPES_META.find((t) => t.value === value)?.label ?? value;

export const getVehicleStatusLabel = (value: string) =>
  VEHICLE_STATUS_META.find((s) => s.value === value)?.label ?? value;

export const isActiveVehicleStatus = (status: string) =>
  status === "AVAILABLE" || status === "IN_USE" || status === "IN_TRANSIT";
