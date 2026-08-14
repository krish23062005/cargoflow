import QRCode from "qrcode";
import { getPortalData, getPortalUrl } from "@/server/portal";
import { PortalTrackingView } from "@/components/portal/tracking-view";
import { PortalSearch } from "@/components/portal/portal-search";

export const metadata = {
  title: "Track shipment",
  description: "Live status, location and ETA for your CargoFlow shipment.",
};

export const dynamic = "force-dynamic";

export default async function PortalTrackingPage({
  params,
}: {
  params: Promise<{ trackingNumber: string }>;
}) {
  const { trackingNumber } = await params;

  const data = await getPortalData(trackingNumber);
  if (!data) {
    return <PortalSearch />;
  }

  const shareUrl = getPortalUrl(data.shipment.trackingNumber);
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 220, margin: 1 });

  return (
    <PortalTrackingView initial={data} shareUrl={shareUrl} qrDataUrl={qrDataUrl} />
  );
}