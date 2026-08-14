export const DRIVER_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "ON_TRIP",
  "OFF_DUTY",
  "SUSPENDED",
] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_STATUS_META: {
  value: DriverStatus;
  label: string;
  description: string;
}[] = [
  { value: "AVAILABLE", label: "Available", description: "Ready for assignment" },
  { value: "ASSIGNED", label: "Assigned", description: "Allocated to a vehicle" },
  { value: "ON_TRIP", label: "On trip", description: "Currently on an assignment" },
  { value: "OFF_DUTY", label: "Off duty", description: "On leave or resting" },
  { value: "SUSPENDED", label: "Suspended", description: "Temporarily not allowed to drive" },
];

export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const getDriverStatusLabel = (value: string) =>
  DRIVER_STATUS_META.find((s) => s.value === value)?.label ?? value;

export const isActiveDriverStatus = (status: string) =>
  status === "AVAILABLE" || status === "ASSIGNED" || status === "ON_TRIP";
