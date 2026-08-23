import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Voyage — Shore Hopper" },
      { name: "description", content: "Your Shore Hopper bookings, excursions and profile." },
      { property: "og:title", content: "My Voyage — Shore Hopper" },
      { property: "og:description", content: "Your bookings, excursions and profile." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <p className="eyebrow text-brass">Passenger</p>
      <h1 className="mt-3 text-4xl">My voyage</h1>
      <p className="mt-4 text-muted-foreground">Signed in as {user?.email}</p>
      <div className="rule-brass mt-8" />
      <p className="mt-8 text-muted-foreground">
        Manage your shore excursion reservations, change dates or party size, and pay any balance.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/account/bookings">My reservations</Link>
        </Button>
        {isAdmin ? (
          <>
            <Button asChild variant="outline">
              <Link to="/admin/audit-log">Admin audit log</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/refunds">Refund requests</Link>
            </Button>
          </>
        ) : null}
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

