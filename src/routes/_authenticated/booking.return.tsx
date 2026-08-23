import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { z } from "zod";
import { confirmBookingPayment } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/booking/return")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Booking Confirmation — Shore Hopper" },
      { name: "description", content: "Your shore excursion payment result and reservation reference." },
      { property: "og:title", content: "Booking Confirmation — Shore Hopper" },
      { property: "og:description", content: "Your shore excursion reservation result." },
    ],
  }),
  component: BookingReturnPage,
});

function BookingReturnPage() {
  const { session_id: sessionId } = Route.useSearch();

  const confirm = useQuery({
    queryKey: ["confirm-payment", sessionId],
    enabled: Boolean(sessionId),
    retry: false,
    queryFn: () =>
      confirmBookingPayment({
        data: { sessionId: sessionId!, environment: getStripeEnvironment() },
      }),
  });

  const result = confirm.data;
  const state = confirm.isLoading
    ? "loading"
    : !result || "error" in result
      ? "error"
      : result.status;

  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      {state === "loading" ? (
        <p className="text-muted-foreground">Confirming your payment…</p>
      ) : state === "paid" ? (
        <>
          <CheckCircle2 className="mx-auto size-12 text-brass" />
          <h1 className="mt-6 text-4xl">Your excursion is confirmed</h1>
          <p className="mt-4 text-muted-foreground">
            Reference{" "}
            <span className="font-display text-foreground">
              {result && "reference" in result ? result.reference : ""}
            </span>
            . A confirmation is on its way to your inbox.
          </p>
        </>
      ) : state === "pending" ? (
        <>
          <Clock className="mx-auto size-12 text-brass" />
          <h1 className="mt-6 text-4xl">Payment is settling</h1>
          <p className="mt-4 text-muted-foreground">
            Your bank is still processing the payment. We'll confirm your places as soon as it clears.
          </p>
        </>
      ) : (
        <>
          <XCircle className="mx-auto size-12 text-destructive" />
          <h1 className="mt-6 text-4xl">We couldn't confirm this payment</h1>
          <p className="mt-4 text-muted-foreground">
            {result && "error" in result
              ? result.error
              : "Please open your reservation and try paying again."}
          </p>
        </>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/account/bookings">My reservations</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/cruises">Find more excursions</Link>
        </Button>
      </div>
    </div>
  );
}
