import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BanknoteArrowDown } from "lucide-react";
import { decideRefundRequest, listRefundRequests } from "@/lib/admin-refunds.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Requests — Shore Hopper Admin" },
      {
        name: "description",
        content:
          "Review passenger cancellation requests and approve or decline shore excursion refunds.",
      },
      { property: "og:title", content: "Refund Requests — Shore Hopper Admin" },
      {
        property: "og:description",
        content: "Approve or decline excursion refunds from one admin queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RefundsPage,
});

type StatusFilter = "pending" | "approved" | "declined" | "all";

function RefundsPage() {
  const { isAdmin, checking: roleLoading } = useIsAdmin();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-refund-requests", status],
    queryFn: () => listRefundRequests({ data: { status } }),
    enabled: isAdmin,
  });

  if (roleLoading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-3xl">Admins only</h1>
        <p className="mt-3 text-muted-foreground">
          This queue is restricted to Shore Hopper administrators.
        </p>
        <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/account">Back to my account</Link>
        </Button>
      </div>
    );
  }

  async function decide(requestId: string, decision: "approve" | "decline") {
    setBusyId(requestId);
    try {
      const result = await decideRefundRequest({
        data: {
          requestId,
          decision,
          note: notes[requestId]?.trim() || undefined,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      await queryClient.invalidateQueries({ queryKey: ["admin-refund-requests"] });
      toast.success(
        decision === "approve"
          ? result.refunded
            ? "Refund issued to the passenger's card."
            : "Refund approved. No card payment was found to reverse."
          : "Refund request declined.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't process that decision.");
    } finally {
      setBusyId(null);
    }
  }

  const stats = query.data?.stats;
  const requests = query.data?.requests ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="eyebrow text-brass">Administration</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-4xl">
          <BanknoteArrowDown className="h-7 w-7 text-brass" aria-hidden />
          Refund requests
        </h1>
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="all">All requests</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Passengers cancelling a paid excursion raise a request here. Approving one reverses the card
        payment and marks the reservation refunded.
      </p>
      <div className="rule-brass mt-6" />

      {stats ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pending", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Declined", value: stats.declined },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-brass/30 bg-ivory/60 p-5">
              <p className="eyebrow text-brass">{card.label}</p>
              <p className="mt-2 font-display text-3xl">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-10 space-y-5">
        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : requests.length === 0 ? (
          <p className="text-muted-foreground">No requests in this view.</p>
        ) : (
          requests.map((request) => {
            const booking = request.bookings;
            return (
              <div key={request.id} className="rounded-lg border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-brass">Ref {booking?.reference}</p>
                    <h2 className="mt-1 font-display text-xl">{booking?.excursions?.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking?.excursions?.ports?.name} · {formatDate(booking?.tour_date ?? "")} ·{" "}
                      {booking?.party_size} guest{booking?.party_size === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking?.lead_passenger_name} · {booking?.lead_passenger_email}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{request.status}</Badge>
                    <p className="mt-2 font-display text-2xl">
                      {formatMoney(
                        request.amount ?? booking?.total_amount ?? 0,
                        request.currency ?? booking?.currency ?? "USD",
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDate(request.created_at)}
                    </p>
                  </div>
                </div>

                {request.reason ? (
                  <p className="mt-4 text-sm">
                    <span className="text-muted-foreground">Passenger note: </span>
                    {request.reason}
                  </p>
                ) : null}

                {request.status === "pending" ? (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Input
                      placeholder="Internal note (optional)"
                      value={notes[request.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })}
                      className="max-w-sm"
                    />
                    <Button
                      disabled={busyId === request.id}
                      onClick={() => decide(request.id, "approve")}
                      className="bg-brass text-brass-foreground hover:bg-brass-soft"
                    >
                      Approve &amp; refund
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyId === request.id}
                      onClick={() => decide(request.id, "decline")}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Reviewed {request.reviewed_at ? formatDate(request.reviewed_at) : "—"}
                    {request.admin_note ? ` — ${request.admin_note}` : ""}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
