import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverContext } from "@/server/driver";
import { TripHistory } from "@/components/driver/trip-history";

export const metadata: Metadata = {
  title: "My trips",
};

export default async function DriverHistoryPage() {
  const context = await getDriverContext();
  if (!context) {
    redirect("/driver/login");
  }
  return (
    <div className="mx-auto w-full max-w-md px-4 py-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">My trips</h1>
        <p className="text-xs text-muted-foreground">
          {context.driver.name} · {context.organization.name}
        </p>
      </header>
      <TripHistory />
    </div>
  );
}