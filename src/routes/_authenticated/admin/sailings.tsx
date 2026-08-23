import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  getAdminCatalog,
  upsertCruiseLine,
  upsertShip,
  upsertSailing,
  setSailingPublished,
  deleteSailing,
  listPortCalls,
  upsertPortCall,
  deletePortCall,
} from "@/lib/admin-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatDate, shortTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/sailings")({
  head: () => ({
    meta: [
      { title: "Cruise Data — Shore Hopper Admin" },
      {
        name: "description",
        content: "Manage cruise lines, ships, sailings and the day-by-day port call timetable.",
      },
      { property: "og:title", content: "Cruise Data — Shore Hopper Admin" },
      { property: "og:description", content: "Cruise lines, ships, sailings and port timetables." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminSailingsPage,
});

type LineForm = { id?: string; name: string; description: string; logo_url: string };
type ShipForm = {
  id?: string;
  cruise_line_id: string;
  name: string;
  capacity: string;
  year_built: string;
  description: string;
};
type SailingForm = {
  id?: string;
  ship_id: string;
  name: string;
  region: string;
  departure_date: string;
  arrival_date: string;
  departure_port_id: string;
  arrival_port_id: string;
  starting_price: string;
  description: string;
  hero_image_url: string;
  is_published: boolean;
};
type CallForm = {
  id?: string;
  sailing_id: string;
  port_id: string;
  day_number: string;
  call_date: string;
  arrival_time: string;
  departure_time: string;
  is_sea_day: boolean;
  notes: string;
};

function AdminSailingsPage() {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });

  const [lineForm, setLineForm] = useState<LineForm | null>(null);
  const [shipForm, setShipForm] = useState<ShipForm | null>(null);
  const [sailingForm, setSailingForm] = useState<SailingForm | null>(null);
  const [callForm, setCallForm] = useState<CallForm | null>(null);
  const [timetableId, setTimetableId] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-port-calls"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const saveLine = useMutation({
    mutationFn: (f: LineForm) =>
      upsertCruiseLine({
        data: {
          ...(f.id ? { id: f.id } : {}),
          name: f.name,
          description: f.description,
          logo_url: f.logo_url,
        },
      }),
    onSuccess: async () => {
      toast.success("Cruise line saved");
      setLineForm(null);
      await refresh();
    },
    onError,
  });

  const saveShip = useMutation({
    mutationFn: (f: ShipForm) =>
      upsertShip({
        data: {
          ...(f.id ? { id: f.id } : {}),
          cruise_line_id: f.cruise_line_id,
          name: f.name,
          capacity: f.capacity ? Number(f.capacity) : null,
          year_built: f.year_built ? Number(f.year_built) : null,
          description: f.description,
        },
      }),
    onSuccess: async () => {
      toast.success("Ship saved");
      setShipForm(null);
      await refresh();
    },
    onError,
  });

  const saveSailing = useMutation({
    mutationFn: (f: SailingForm) =>
      upsertSailing({
        data: {
          ...(f.id ? { id: f.id } : {}),
          ship_id: f.ship_id,
          name: f.name,
          region: f.region,
          departure_date: f.departure_date,
          arrival_date: f.arrival_date,
          departure_port_id: f.departure_port_id || null,
          arrival_port_id: f.arrival_port_id || null,
          starting_price: f.starting_price ? Number(f.starting_price) : null,
          description: f.description,
          hero_image_url: f.hero_image_url,
          is_published: f.is_published,
        },
      }),
    onSuccess: async () => {
      toast.success("Sailing saved");
      setSailingForm(null);
      await refresh();
    },
    onError,
  });

  const publish = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) => setSailingPublished({ data: v }),
    onSuccess: refresh,
    onError,
  });

  const removeSailing = useMutation({
    mutationFn: (id: string) => deleteSailing({ data: { id } }),
    onSuccess: async () => {
      toast.success("Sailing deleted");
      await refresh();
    },
    onError,
  });

  const calls = useQuery({
    queryKey: ["admin-port-calls", timetableId],
    queryFn: () => listPortCalls({ data: { sailingId: timetableId! } }),
    enabled: Boolean(timetableId),
  });

  const saveCall = useMutation({
    mutationFn: (f: CallForm) =>
      upsertPortCall({
        data: {
          ...(f.id ? { id: f.id } : {}),
          sailing_id: f.sailing_id,
          port_id: f.port_id || null,
          day_number: Number(f.day_number),
          call_date: f.call_date,
          arrival_time: f.arrival_time,
          departure_time: f.departure_time,
          is_sea_day: f.is_sea_day,
          notes: f.notes,
        },
      }),
    onSuccess: async () => {
      toast.success("Port call saved");
      setCallForm(null);
      await refresh();
    },
    onError,
  });

  const removeCall = useMutation({
    mutationFn: (id: string) => deletePortCall({ data: { id } }),
    onSuccess: async () => {
      toast.success("Port call removed");
      await refresh();
    },
    onError,
  });

  const lines = catalog.data?.cruiseLines ?? [];
  const ships = catalog.data?.ships ?? [];
  const sailings = catalog.data?.sailings ?? [];
  const ports = catalog.data?.ports ?? [];
  const timetableSailing = sailings.find((s) => s.id === timetableId) ?? null;

  return (
    <div>
      <p className="eyebrow text-brass">Catalogue</p>
      <h1 className="mt-2 text-4xl">Cruise data</h1>
      <div className="rule-brass mt-6" />

      {catalog.isLoading ? (
        <Skeleton className="mt-8 h-80 w-full" />
      ) : (
        <Tabs defaultValue="sailings" className="mt-8">
          <TabsList>
            <TabsTrigger value="sailings">Sailings</TabsTrigger>
            <TabsTrigger value="ships">Ships</TabsTrigger>
            <TabsTrigger value="lines">Cruise lines</TabsTrigger>
          </TabsList>

          <TabsContent value="sailings" className="mt-6">
            <div className="flex justify-end">
              <Button
                className="bg-brass text-brass-foreground hover:bg-brass-soft"
                onClick={() =>
                  setSailingForm({
                    ship_id: ships[0]?.id ?? "",
                    name: "",
                    region: "",
                    departure_date: "",
                    arrival_date: "",
                    departure_port_id: "",
                    arrival_port_id: "",
                    starting_price: "",
                    description: "",
                    hero_image_url: "",
                    is_published: false,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> New sailing
              </Button>
            </div>
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {sailings.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.ships?.cruise_lines?.name} · {s.ships?.name} · {formatDate(s.departure_date)} →{" "}
                      {formatDate(s.arrival_date)} · {s.nights} nights · {s.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={s.is_published ? "border-brass/60 text-brass" : ""}>
                      {s.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => publish.mutate({ id: s.id, is_published: !s.is_published })}
                    >
                      {s.is_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTimetableId(s.id)}>
                      Timetable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSailingForm({
                          id: s.id,
                          ship_id: s.ship_id,
                          name: s.name,
                          region: s.region,
                          departure_date: s.departure_date,
                          arrival_date: s.arrival_date,
                          departure_port_id: s.departure_port_id ?? "",
                          arrival_port_id: s.arrival_port_id ?? "",
                          starting_price: s.starting_price ? String(s.starting_price) : "",
                          description: "",
                          hero_image_url: "",
                          is_published: s.is_published,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeSailing.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="ships" className="mt-6">
            <div className="flex justify-end">
              <Button
                className="bg-brass text-brass-foreground hover:bg-brass-soft"
                onClick={() =>
                  setShipForm({
                    cruise_line_id: lines[0]?.id ?? "",
                    name: "",
                    capacity: "",
                    year_built: "",
                    description: "",
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> New ship
              </Button>
            </div>
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {ships.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-display text-lg">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.cruise_lines?.name}
                      {s.capacity ? ` · ${s.capacity} guests` : ""}
                      {s.year_built ? ` · ${s.year_built}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShipForm({
                        id: s.id,
                        cruise_line_id: s.cruise_line_id,
                        name: s.name,
                        capacity: s.capacity ? String(s.capacity) : "",
                        year_built: s.year_built ? String(s.year_built) : "",
                        description: "",
                      })
                    }
                  >
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="lines" className="mt-6">
            <div className="flex justify-end">
              <Button
                className="bg-brass text-brass-foreground hover:bg-brass-soft"
                onClick={() => setLineForm({ name: "", description: "", logo_url: "" })}
              >
                <Plus className="mr-2 h-4 w-4" /> New cruise line
              </Button>
            </div>
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-display text-lg">{l.name}</p>
                    <p className="text-sm text-muted-foreground">{l.source}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLineForm({
                        id: l.id,
                        name: l.name,
                        description: l.description ?? "",
                        logo_url: l.logo_url ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      )}

      {/* Cruise line dialog */}
      <Dialog open={lineForm !== null} onOpenChange={(o) => (o ? null : setLineForm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lineForm?.id ? "Edit cruise line" : "New cruise line"}</DialogTitle>
          </DialogHeader>
          {lineForm ? (
            <div className="space-y-4">
              <Field label="Name">
                <Input value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })} />
              </Field>
              <Field label="Logo URL">
                <Input
                  value={lineForm.logo_url}
                  onChange={(e) => setLineForm({ ...lineForm, logo_url: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={lineForm.description}
                  onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={saveLine.isPending}
              onClick={() => lineForm && saveLine.mutate(lineForm)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship dialog */}
      <Dialog open={shipForm !== null} onOpenChange={(o) => (o ? null : setShipForm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shipForm?.id ? "Edit ship" : "New ship"}</DialogTitle>
          </DialogHeader>
          {shipForm ? (
            <div className="space-y-4">
              <Field label="Cruise line">
                <Select
                  value={shipForm.cruise_line_id}
                  onValueChange={(v) => setShipForm({ ...shipForm, cruise_line_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a cruise line" />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Name">
                <Input value={shipForm.name} onChange={(e) => setShipForm({ ...shipForm, name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Capacity">
                  <Input
                    type="number"
                    value={shipForm.capacity}
                    onChange={(e) => setShipForm({ ...shipForm, capacity: e.target.value })}
                  />
                </Field>
                <Field label="Year built">
                  <Input
                    type="number"
                    value={shipForm.year_built}
                    onChange={(e) => setShipForm({ ...shipForm, year_built: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={saveShip.isPending}
              onClick={() => shipForm && saveShip.mutate(shipForm)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sailing dialog */}
      <Dialog open={sailingForm !== null} onOpenChange={(o) => (o ? null : setSailingForm(null))}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{sailingForm?.id ? "Edit sailing" : "New sailing"}</DialogTitle>
          </DialogHeader>
          {sailingForm ? (
            <div className="space-y-4">
              <Field label="Ship">
                <Select
                  value={sailingForm.ship_id}
                  onValueChange={(v) => setSailingForm({ ...sailingForm, ship_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a ship" />
                  </SelectTrigger>
                  <SelectContent>
                    {ships.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.cruise_lines?.name} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Name">
                <Input
                  value={sailingForm.name}
                  onChange={(e) => setSailingForm({ ...sailingForm, name: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Region">
                  <Input
                    value={sailingForm.region}
                    onChange={(e) => setSailingForm({ ...sailingForm, region: e.target.value })}
                  />
                </Field>
                <Field label="Starting price">
                  <Input
                    type="number"
                    value={sailingForm.starting_price}
                    onChange={(e) => setSailingForm({ ...sailingForm, starting_price: e.target.value })}
                  />
                </Field>
                <Field label="Departure date">
                  <Input
                    type="date"
                    value={sailingForm.departure_date}
                    onChange={(e) => setSailingForm({ ...sailingForm, departure_date: e.target.value })}
                  />
                </Field>
                <Field label="Arrival date">
                  <Input
                    type="date"
                    value={sailingForm.arrival_date}
                    onChange={(e) => setSailingForm({ ...sailingForm, arrival_date: e.target.value })}
                  />
                </Field>
                <Field label="Departure port">
                  <Select
                    value={sailingForm.departure_port_id}
                    onValueChange={(v) => setSailingForm({ ...sailingForm, departure_port_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Arrival port">
                  <Select
                    value={sailingForm.arrival_port_id}
                    onValueChange={(v) => setSailingForm({ ...sailingForm, arrival_port_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Hero image URL">
                <Input
                  value={sailingForm.hero_image_url}
                  onChange={(e) => setSailingForm({ ...sailingForm, hero_image_url: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={sailingForm.description}
                  onChange={(e) => setSailingForm({ ...sailingForm, description: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Switch
                  checked={sailingForm.is_published}
                  onCheckedChange={(v) => setSailingForm({ ...sailingForm, is_published: v })}
                />
                <span className="text-sm">Published on the public site</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSailingForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={saveSailing.isPending}
              onClick={() => sailingForm && saveSailing.mutate(sailingForm)}
            >
              Save sailing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timetable dialog */}
      <Dialog open={timetableId !== null} onOpenChange={(o) => (o ? null : setTimetableId(null))}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Timetable — {timetableSailing?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCallForm({
                  sailing_id: timetableId!,
                  port_id: "",
                  day_number: String((calls.data?.length ?? 0) + 1),
                  call_date: timetableSailing?.departure_date ?? "",
                  arrival_time: "",
                  departure_time: "",
                  is_sea_day: false,
                  notes: "",
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add day
            </Button>
          </div>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(calls.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">
                    Day {c.day_number} · {formatDate(c.call_date)} ·{" "}
                    {c.is_sea_day ? "At sea" : (c.ports?.name ?? "—")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.arrival_time ? `In ${shortTime(c.arrival_time)}` : ""}
                    {c.departure_time ? ` · Out ${shortTime(c.departure_time)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCallForm({
                        id: c.id,
                        sailing_id: c.sailing_id,
                        port_id: c.port_id ?? "",
                        day_number: String(c.day_number),
                        call_date: c.call_date,
                        arrival_time: c.arrival_time ?? "",
                        departure_time: c.departure_time ?? "",
                        is_sea_day: c.is_sea_day,
                        notes: c.notes ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeCall.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Port call dialog */}
      <Dialog open={callForm !== null} onOpenChange={(o) => (o ? null : setCallForm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{callForm?.id ? "Edit port call" : "Add port call"}</DialogTitle>
          </DialogHeader>
          {callForm ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={callForm.is_sea_day}
                  onCheckedChange={(v) => setCallForm({ ...callForm, is_sea_day: v })}
                />
                <span className="text-sm">Sea day</span>
              </div>
              {!callForm.is_sea_day ? (
                <Field label="Port">
                  <Select value={callForm.port_id} onValueChange={(v) => setCallForm({ ...callForm, port_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Day number">
                  <Input
                    type="number"
                    value={callForm.day_number}
                    onChange={(e) => setCallForm({ ...callForm, day_number: e.target.value })}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    value={callForm.call_date}
                    onChange={(e) => setCallForm({ ...callForm, call_date: e.target.value })}
                  />
                </Field>
                <Field label="Arrival time">
                  <Input
                    type="time"
                    value={callForm.arrival_time}
                    onChange={(e) => setCallForm({ ...callForm, arrival_time: e.target.value })}
                  />
                </Field>
                <Field label="Departure time">
                  <Input
                    type="time"
                    value={callForm.departure_time}
                    onChange={(e) => setCallForm({ ...callForm, departure_time: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea
                  rows={2}
                  value={callForm.notes}
                  onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={saveCall.isPending}
              onClick={() => callForm && saveCall.mutate(callForm)}
            >
              Save day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
