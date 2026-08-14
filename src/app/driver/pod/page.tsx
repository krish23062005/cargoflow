import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverContext } from "@/server/driver";
import { getProofByShipment, getShipmentQr } from "@/server/pod";
import { PodCapture, type PodInitial } from "@/components/driver/pod-capture";

export const metadata: Metadata = {
  title: "Proof of delivery",
};

export default async function DriverPodPage() {
  const context = await getDriverContext();
  if (!context) {
    redirect("/driver/login");
  }
  if (!context.shipment) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium">No shipment to deliver</p>
        <p className="text-xs text-muted-foreground">
          You&apos;ll be able to capture proof of delivery once a shipment is assigned to you.
        </p>
      </div>
    );
  }

  const [proof, qr] = await Promise.all([
    getProofByShipment({ organizationId: context.organizationId, shipmentId: context.shipment.id }),
    getShipmentQr({ organizationId: context.organizationId, shipmentId: context.shipment.id }),
  ]);

  const initial: PodInitial = {
    shipmentId: context.shipment.id,
    trackingNumber: context.shipment.trackingNumber,
    originAddress: context.shipment.originAddress,
    destinationAddress: context.shipment.destinationAddress,
    customerName: context.shipment.customerName,
    driverName: context.driver.name,
    qr,
    proof: proof
      ? {
          recipientName: proof.recipientName,
          recipientPhone: proof.recipientPhone,
          notes: proof.notes,
          capturedByName: proof.capturedByName,
          capturedAt: proof.capturedAt.toISOString(),
          signature: proof.signature,
          photos: Array.isArray(proof.photos)
            ? (proof.photos as { dataUrl: string; contentType: string }[])
            : [],
        }
      : null,
  };

  return <PodCapture initial={initial} />;
}