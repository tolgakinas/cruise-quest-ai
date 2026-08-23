import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  listAdminBookings,
  setBookingStatus,
  adminUpdateBooking,
  exportBookingsCsv,
} from "@/lib/admin-bookings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  head: () => ({
    meta: [
      { title: "Reservations — Shore Hopper Admin" },
      {
        name: "description",
        content: "Review, correct, confirm and cancel excursion reservations, and export them to CSV.",
      },
      { property: "og:title", content: "Reservations — Shore Hopper Admin" },
      { property: "og:description", content: "Full control over excursion reservations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBookingsPage,
});

type Status = "all" | "reserved" | "confirmed" | "cancelled" | "refunded";

type EditForm = {
  id: string;
  reference: string;
  partySize: string;
  tourDate: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  cabinNumber: string;
  notes: string;
};

function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edit, setEdit] = useState<EditForm | null>(null);

  const filters = {
    status,
    q: q || null,
    from: from || null,
    to: to || null,
    limit: 200,
  };

  const list = useQuery({
    queryKey: ["admin-bookings", status, q, from, to],
    queryFn: () => listAdminBookings({ data: filters }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
  const onError = (e: Error) => toast.error(e.message);

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: Exclude<Status, "all"> }) =>
      setBookingStatus({ data: v }),
    onSuccess: async () => {
      toast.success("Reservation updated");
      await refresh();
    },
    onError,
  });

  const save = useMutation({
    mutationFn: (f: EditForm) =>
      adminUpdateBooking({
        data: {
          id: f.id,
          partySize: Number(f.partySize),
          tourDate: f.tourDate,
          leadName: f.leadName,
          leadEmail: f.leadEmail,
          leadPhone: f.leadPhone,
          cabinNumber: f.cabinNumber,
          notes: f.notes,
        },
      }),
    onSuccess: async (result) => {
      toast.success(`Saved — new total ${formatMoney(result.total, result.currency)}`);
      setEdit(null);
      await refresh();
    },
    onError,
  });

  const exportCsv = useMutation({
    mutationFn: () => exportBookingsCsv({ data: filters }),
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shore-hopper-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">Operations</p>
          <h1 className="mt-2 text-4xl">Reservations</h1>
        </div>
        <Button variant="outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="rule-brass mt-6" />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Reference, name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Tour date from" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Tour date to" />
      </div>

      {list.isLoading ? (
        <Skeleton className="mt-8 h-80 w-full" />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {(list.data ?? []).length === 0 ? (
            <li className="p-6 text-muted-foreground">No reservations match these filters.</li>
          ) : (
            (list.data ?? []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-display text-lg">
                    {b.reference} · {b.excursions?.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.excursions?.ports?.name} · {formatDate(b.tour_date)} · {b.party_size} guests ·{" "}
                    {formatMoney(b.total_amount, b.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.lead_passenger_name} · {b.lead_passenger_email}
                    {b.cabin_number ? ` · cabin ${b.cabin_number}` : ""}
                  </p>
                  {(b.booking_addons ?? []).length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Extras: {(b.booking_addons ?? []).map((a) => `${a.name} ×${a.quantity}`).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={b.status === "confirmed" ? "border-brass/60 text-brass" : ""}>
                    {b.status}
                  </Badge>
                  {b.status !== "confirmed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changeStatus.mutate({ id: b.id, status: "confirmed" })}
                    >
                      Confirm
                    </Button>
                  ) : null}
                  {b.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changeStatus.mutate({ id: b.id, status: "cancelled" })}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEdit({
                        id: b.id,
                        reference: b.reference,
                        partySize: String(b.party_size),
                        tourDate: b.tour_date,
                        leadName: b.lead_passenger_name,
                        leadEmail: b.lead_passenger_email,
                        leadPhone: b.lead_passenger_phone ?? "",
                        cabinNumber: b.cabin_number ?? "",
                        notes: b.notes ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      <Dialog open={edit !== null} onOpenChange={(o) => (o ? null : setEdit(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit reservation {edit?.reference}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tour date</Label>
                  <Input
                    type="date"
                    value={edit.tourDate}
                    onChange={(e) => setEdit({ ...edit, tourDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Party size</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edit.partySize}
                    onChange={(e) => setEdit({ ...edit, partySize: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lead passenger</Label>
                <Input value={edit.leadName} onChange={(e) => setEdit({ ...edit, leadName: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={edit.leadEmail}
                    onChange={(e) => setEdit({ ...edit, leadEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={edit.leadPhone} onChange={(e) => setEdit({ ...edit, leadPhone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cabin number</Label>
                <Input
                  value={edit.cabinNumber}
                  onChange={(e) => setEdit({ ...edit, cabinNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Totals are recalculated on the server from the excursion price, party size and extras.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={save.isPending}
              onClick={() => edit && save.mutate(edit)}
            >
              Save reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
