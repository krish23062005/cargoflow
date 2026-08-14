import {
  BarChart3,
  LayoutDashboard,
  Map,
  Package,
  Radio,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false → rendered as a disabled "coming soon" item (episodes land later) */
  enabled: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/fleet", label: "Fleet", icon: Truck, enabled: true },
  { href: "/drivers", label: "Drivers", icon: Users, enabled: true },
  { href: "/shipments", label: "Shipments", icon: Package, enabled: true },
  { href: "/routes", label: "Routes", icon: Map, enabled: true },
  { href: "/tracking", label: "Live tracking", icon: Radio, enabled: true },
  { href: "/reports", label: "Reports", icon: BarChart3, enabled: true },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings/organization",
  label: "Settings",
  icon: Settings,
  enabled: true,
};
