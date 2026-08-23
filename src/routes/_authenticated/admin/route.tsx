import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  Anchor,
  BanknoteArrowDown,
  CalendarClock,
  LayoutDashboard,
  Mail,
  MapPin,
  ScrollText,
  Ship,
  Ticket,
  Users,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const links: { to: string; label: string; icon: typeof Ticket; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/excursions", label: "Excursions", icon: Ticket },
  { to: "/admin/ports", label: "Ports", icon: MapPin },
  { to: "/admin/sailings", label: "Cruise data", icon: Ship },
  { to: "/admin/bookings", label: "Reservations", icon: CalendarClock },
  { to: "/admin/refunds", label: "Refunds", icon: BanknoteArrowDown },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/notifications", label: "Notifications", icon: Mail },
  { to: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

function AdminLayout() {
  const { isAdmin, checking } = useIsAdmin();

  if (checking) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <Anchor className="mx-auto h-8 w-8 text-brass" />
        <h1 className="mt-6 text-3xl">Admins only</h1>
        <p className="mt-3 text-muted-foreground">
          This area is restricted to Shore Hopper administrators.
        </p>
        <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/account">Back to my account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <p className="eyebrow text-brass">Shore Hopper</p>
        <h2 className="mt-2 font-display text-2xl">Admin</h2>
        <div className="rule-brass mt-4" />
        <nav className="mt-6 flex flex-wrap gap-2 lg:flex-col">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.exact ?? false }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground" }}
            >
              <link.icon className="h-4 w-4 text-brass" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
