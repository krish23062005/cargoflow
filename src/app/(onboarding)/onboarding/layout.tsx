import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Onboarding",
    template: "%s · CargoFlow",
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
