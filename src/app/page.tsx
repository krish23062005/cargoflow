import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  MapPin,
  Package,
  Radio,
  Route,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Fleet tracking & shipment management for African logistics",
  description:
    "CargoFlow helps African fleet owners track vehicles, manage shipments, plan routes and deliver with confidence — built for the realities of African roads.",
};

const FEATURES = [
  {
    icon: Radio,
    title: "Live fleet tracking",
    description:
      "See every vehicle on a live map with GPS updates that save data and battery — built for spotty African connectivity.",
  },
  {
    icon: Package,
    title: "Shipment management",
    description:
      "Create, assign and track shipments from pickup to proof of delivery with a full event history on every job.",
  },
  {
    icon: Route,
    title: "Route planning",
    description:
      "Plan multi-stop routes with fuel stops, rest points and border crossings. Know your ETA before you leave.",
  },
  {
    icon: Users,
    title: "Driver management",
    description:
      "Track licenses, emergency contacts and trip history. Assign drivers to vehicles without double-booking.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant & secure",
    description:
      "Every organization gets isolated data with role-based access for owners, admins, dispatchers and viewers.",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    description:
      "Understand fleet utilization, on-time delivery and driver performance to make profitable decisions.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create your organization",
    description:
      "Set up your workspace with your country, currency and timezone — everything tuned for where you operate.",
  },
  {
    number: "02",
    title: "Add vehicles & drivers",
    description:
      "Register your fleet, add drivers with their licenses, and assign vehicles to drivers in a few clicks.",
  },
  {
    number: "03",
    title: "Move cargo with visibility",
    description:
      "Create shipments, assign them to your team, track them live and prove delivery — end to end.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "CargoFlow replaced our spreadsheet chaos. We know exactly where every truck is, all the time.",
    name: "Adaeze O.",
    role: "Fleet Manager, Lagos",
  },
  {
    quote:
      "Border crossings used to mean hours of phone calls. Now our team sees ETAs in real time.",
    name: "Samuel K.",
    role: "Operations Lead, Nairobi",
  },
  {
    quote:
      "My drivers use it on basic Android phones with patchy data. It just works.",
    name: "Yaw A.",
    role: "Owner, Accra",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = Boolean(session?.user);

  return (
    <div className="flex min-h-svh flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Button asChild>
                <Link href="/dashboard">
                  Open dashboard <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">
                    Get started <ArrowRight />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.15),transparent_60%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3.5" />
              Built for African roads
            </span>
            <h1 className="mt-6 font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Know where your{" "}
              <span className="text-primary">fleet is</span>, always.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              CargoFlow gives African logistics companies live tracking, shipment
              management and route planning — on a platform designed for real-world
              roads, connectivity and budgets.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                  {signedIn ? "Open dashboard" : "Start tracking free"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Book a demo</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No hardware required", "Works offline-first", "Pay as you grow"].map(
                (f) => (
                  <span key={f} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    {f}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium">Live fleet</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  12 online
                </span>
              </div>
              <div className="relative h-56 overflow-hidden rounded-xl bg-muted">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_95%,hsl(var(--border))_95%)] bg-[size:40px_40px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_95%,hsl(var(--border))_95%)] bg-[size:40px_40px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                      <Truck className="size-4 text-primary" />
                      <span>KIA-992X</span>
                      <span className="ml-4 text-muted-foreground">Lagos → Ibadan</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                      <Truck className="size-4 text-amber-500" />
                      <span>GHC-118Y</span>
                      <span className="ml-4 text-muted-foreground">Accra → Kumasi</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                      <Truck className="size-4 text-emerald-500" />
                      <span>TZ-4457B</span>
                      <span className="ml-4 text-muted-foreground">Dar → Arusha</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Active shipments", value: "34" },
                  { label: "On-time rate", value: "96%" },
                  { label: "Km tracked", value: "18.2k" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border p-3">
                    <p className="text-lg font-semibold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / trust bar */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-8 text-sm font-medium text-muted-foreground sm:px-6">
          <span className="uppercase tracking-wider text-xs">Trusted by fleets across</span>
          <span>Nigeria</span>
          <span>Kenya</span>
          <span>Ghana</span>
          <span>South Africa</span>
          <span>Tanzania</span>
          <span>Uganda</span>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to run a fleet
          </h2>
          <p className="mt-4 text-muted-foreground">
            From the first vehicle to a thousand — CargoFlow grows with your operation.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-xl border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Up and running in minutes
            </h2>
            <p className="mt-4 text-muted-foreground">
              No hardware, no installation, no training marathon.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="relative">
                <div className="text-sm font-semibold text-primary">{step.number}</div>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Loved by operators across Africa
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-xl border bg-card p-6">
              <blockquote className="text-sm text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border bg-primary px-6 py-16 text-center text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.2),transparent_55%)]" />
          <h2 className="relative font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to know where your fleet is?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join the African logistics companies that stopped guessing and started
            tracking.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-background text-foreground hover:bg-background/90"
            >
              <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                {signedIn ? "Open dashboard" : "Create your account"}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} CargoFlow. Built for African logistics.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Bell className="size-3.5" /> Notifications
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
