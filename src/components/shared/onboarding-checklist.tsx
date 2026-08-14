import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ChecklistStep = {
  label: string;
  done: boolean;
  href?: string | null;
  cta?: string;
};

export function OnboardingChecklist({
  title = "Getting started",
  steps,
}: {
  title?: string;
  steps: ChecklistStep[];
}) {
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {remaining === 0
            ? "Everything is set up. Nice work!"
            : `${remaining} step${remaining === 1 ? "" : "s"} remaining`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            {step.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="size-5 shrink-0 text-muted-foreground/50" />
            )}
            <span
              className={
                step.done ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"
              }
            >
              {step.label}
            </span>
            {!step.done && step.href ? (
              <Link
                href={step.href}
                className="ml-auto text-sm font-medium text-primary hover:underline"
              >
                {step.cta ?? "Get started"}
              </Link>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
