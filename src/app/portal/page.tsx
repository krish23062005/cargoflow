import { PortalSearch } from "@/components/portal/portal-search";

export const metadata = {
  title: "Track a shipment",
  description:
    "Enter your tracking number to follow your shipment with CargoFlow.",
};

export default function PortalHomePage() {
  return <PortalSearch />;
}