import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/driver/bottom-nav";
import { RegisterServiceWorker } from "@/components/driver/register-sw";
import { SyncStatus } from "@/components/driver/sync-status";

export const metadata: Metadata = {
  manifest: "/driver-manifest.json",
  appleWebApp: {
    capable: true,
    title: "CargoFlow Driver",
    statusBarStyle: "black-translucent",
  },
  applicationName: "CargoFlow Driver",
  icons: {
    icon: [{ url: "/driver-icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/driver-icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <BottomNav />
      <SyncStatus />
      <RegisterServiceWorker />
    </>
  );
}