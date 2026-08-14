import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * Web App Manifest for the main CargoFlow dashboard. Lets users add the app
 * to their phone home screen / install it as a standalone PWA.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "cargoflow",
    name: "CargoFlow",
    short_name: "CargoFlow",
    description:
      "Fleet tracking, shipment management and route planning for African logistics.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#18181b",
    categories: ["business", "productivity", "navigation"],
    icons: [
      {
        src: "/driver-icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/driver-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/driver-icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/driver-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}