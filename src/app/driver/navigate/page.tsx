import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverContext } from "@/server/driver";
import { NavigationView } from "@/components/driver/navigate-view";

export const metadata: Metadata = {
  title: "Navigate",
};

export default async function DriverNavigatePage() {
  const context = await getDriverContext();
  if (!context) {
    redirect("/driver/login");
  }
  return <NavigationView initial={context} />;
}