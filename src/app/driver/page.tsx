import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverContext } from "@/server/driver";
import { DriverApp } from "@/components/driver/driver-app";

export const metadata: Metadata = {
  title: "Driver App",
};

export default async function DriverHomePage() {
  const context = await getDriverContext();
  if (!context) {
    redirect("/driver/login");
  }
  return <DriverApp initial={context} />;
}