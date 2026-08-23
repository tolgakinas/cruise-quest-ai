const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Live payments are not configured yet. Complete payment go-live to accept real cards.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-brass/40 bg-brass/10 px-4 py-2 text-center text-sm text-foreground">
        Payments in the preview are in test mode — use card 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
