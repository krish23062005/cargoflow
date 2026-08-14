import type { Metadata } from "next";
import { DriverLoginForm } from "@/components/driver/login-form";

export const metadata: Metadata = {
  title: "Driver sign in",
};

export default function DriverLoginPage() {
  return <DriverLoginForm />;
}