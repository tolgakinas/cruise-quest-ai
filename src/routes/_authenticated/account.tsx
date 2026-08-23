import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CalendarClock, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountLayout,
});

const links = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/account/bookings", label: "My reservations", icon: CalendarClock, exact: false },
  { to: "/account/profile", label: "Profile", icon: UserRound, exact: false },
] as const;

function AccountLayout() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <p className="eyebrow text-brass">Passenger</p>
        <h2 className="mt-2 font-display text-2xl">My voyage</h2>
        <p className="mt-2 truncate text-xs text-muted-foreground">{user?.email}</p>
        <div className="rule-brass mt-4" />
        <nav className="mt-6 flex flex-wrap gap-2 lg:flex-col">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.exact }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground" }}
            >
              <link.icon className="h-4 w-4 text-brass" />
              {link.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              to="/admin"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="h-4 w-4 text-brass" />
              Admin panel
            </Link>
          ) : null}
        </nav>
        <Button variant="outline" className="mt-6 w-full" onClick={() => signOut()}>
          Sign out
        </Button>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
