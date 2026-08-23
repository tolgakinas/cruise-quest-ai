import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  listAdminExcursions,
  upsertExcursion,
  setExcursionPublished,
  deleteExcursion,
  listExcursionAddons,
  upsertExcursionAddon,
  deleteExcursionAddon,
} from "@/lib/admin-excursions.functions";
import { getAdminCatalog } from "@/lib/admin-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { formatDuration, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/excursions")({
  head: () => ({
    meta: [
      { title: "Excursions — Shore Hopper Admin" },
      {
        name: "description",
        content: "Create and edit shore excursions, pricing, capacity and optional extras.",
      },
      { property: "og:title", content: "Excursions — Shore Hopper Admin" },
      { property: "og:description", content: "Manage the excursion catalogue and add-ons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminExcursionsPage,
});

type Form = {
  id?: string;
  port_id: string;
  title: string;
  summary: string;
  description: string;
  duration_minutes: string;
  price: string;
  currency: string;
  capacity: string;
  meeting_point: string;
  category: string;
  difficulty: string;
  image_url: string;
  includes: string;
  excludes: string;
  wheelchair_accessible: boolean;
  is_published: boolean;
};

type AddonForm = {
  id?: string;
  excursion_id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  per_guest: boolean;
  is_active: boolean;
  sort_order: string;
};

const emptyForm = (portId: string): Form => ({
  port_id: portId,
  title: "",
  summary: "",
  description: "",
  duration_minutes: "180",
  price: "0",
  currency: "EUR",
  capacity: "20",
  meeting_point: "",
  category: "",
  difficulty: "",
  image_url: "",
  includes: "",
  excludes: "",
  wheelchair_accessible: false,
  is_published: false,
});

function AdminExcursionsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [portId, setPortId] = useState<string>("all");
  const [published, setPublished] = useState<"all" | "published" | "draft">("all");
  const [form, setForm] = useState<Form | null>(null);
  const [addonsFor, setAddonsFor] = useState<{ id: string; title: string } | null>(null);
  const [addonForm, setAddonForm] = useState<AddonForm | null>(null);

  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });
  const ports = catalog.data?.ports ?? [];

  const list = useQuery({
    queryKey: ["admin-excursions", q, portId, published],
    queryFn: () =>
      listAdminExcursions({
        data: { q: q || null, portId: portId === "all" ? null : portId, published },
      }),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-excursions"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-addons"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const save = useMutation({
    mutationFn: (f: Form) =>
      upsertExcursion({
        data: {
          ...(f.id ? { id: f.id } : {}),
          port_id: f.port_id,
          title: f.title,
          summary: f.summary,
          description: f.description,
          duration_minutes: Number(f.duration_minutes),
          price: Number(f.price),
          currency: f.currency.toUpperCase(),
          capacity: Number(f.capacity),
          meeting_point: f.meeting_point,
          category: f.category,
          difficulty: f.difficulty,
          image_url: f.image_url,
          includes: f.includes.split("\n").map((s) => s.trim()).filter(Boolean),
          excludes: f.excludes.split("\n").map((s) => s.trim()).filter(Boolean),
          wheelchair_accessible: f.wheelchair_accessible,
          is_published: f.is_published,
        },
      }),
    onSuccess: async () => {
      toast.success("Excursion saved");
      setForm(null);
      await refresh();
    },
    onError,
  });

  const publish = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) => setExcursionPublished({ data: v }),
    onSuccess: refresh,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExcursion({ data: { id } }),
    onSuccess: async () => {
      toast.success("Excursion deleted");
      await refresh();
    },
    onError,
  });

  const addons = useQuery({
    queryKey: ["admin-addons", addonsFor?.id],
    queryFn: () => listExcursionAddons({ data: { excursionId: addonsFor!.id } }),
    enabled: Boolean(addonsFor),
  });

  const saveAddon = useMutation({
    mutationFn: (f: AddonForm) =>
      upsertExcursionAddon({
        data: {
          ...(f.id ? { id: f.id } : {}),
          excursion_id: f.excursion_id,
          name: f.name,
          description: f.description,
          price: Number(f.price),
          currency: f.currency.toUpperCase(),
          per_guest: f.per_guest,
          is_active: f.is_active,
          sort_order: Number(f.sort_order),
        },
      }),
    onSuccess: async () => {
      toast.success("Add-on saved");
      setAddonForm(null);
      await refresh();
    },
    onError,
  });

  const removeAddon = useMutation({
    mutationFn: (id: string) => deleteExcursionAddon({ data: { id } }),
    onSuccess: async () => {
      toast.success("Add-on removed");
      await refresh();
    },
    onError,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">Catalogue</p>
          <h1 className="mt-2 text-4xl">Excursions</h1>
        </div>
        <Button
          className="bg-brass text-brass-foreground hover:bg-brass-soft"
          onClick={() => setForm(emptyForm(portId === "all" ? (ports[0]?.id ?? "") : portId))}
        >
          <Plus className="mr-2 h-4 w-4" /> New excursion
        </Button>
      </div>
      <div className="rule-brass mt-6" />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={portId} onValueChange={setPortId}>
          <SelectTrigger>
            <SelectValue placeholder="All ports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ports</SelectItem>
            {ports.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={published} onValueChange={(v) => setPublished(v as typeof published)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <Skeleton className="mt-8 h-80 w-full" />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {(list.data ?? []).length === 0 ? (
            <li className="p-6 text-muted-foreground">No excursions match these filters.</li>
          ) : (
            (list.data ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-display text-lg">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.ports?.name} · {formatDuration(e.duration_minutes)} ·{" "}
                    {formatMoney(e.price, e.currency)} · {e.capacity} seats
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={e.is_published ? "border-brass/60 text-brass" : ""}>
                    {e.is_published ? "Published" : "Draft"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => publish.mutate({ id: e.id, is_published: !e.is_published })}
                  >
                    {e.is_published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddonsFor({ id: e.id, title: e.title })}
                  >
                    Add-ons
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: e.id,
                        port_id: e.port_id,
                        title: e.title,
                        summary: e.summary ?? "",
                        description: e.description ?? "",
                        duration_minutes: String(e.duration_minutes),
                        price: String(e.price),
                        currency: e.currency,
                        capacity: String(e.capacity),
                        meeting_point: e.meeting_point ?? "",
                        category: e.category ?? "",
                        difficulty: e.difficulty ?? "",
                        image_url: e.image_url ?? "",
                        includes: (e.includes ?? []).join("\n"),
                        excludes: (e.excludes ?? []).join("\n"),
                        wheelchair_accessible: e.wheelchair_accessible,
                        is_published: e.is_published,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove.mutate(e.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => (o ? null : setForm(null))}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit excursion" : "New excursion"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Port</Label>
                <Select value={form.port_id} onValueChange={(v) => setForm({ ...form, port_id: v })}>
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
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Input
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Meeting point</Label>
                <Input
                  value={form.meeting_point}
                  onChange={(e) => setForm({ ...form, meeting_point: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Includes (one per line)</Label>
                  <Textarea
                    rows={4}
                    value={form.includes}
                    onChange={(e) => setForm({ ...form, includes: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Excludes (one per line)</Label>
                  <Textarea
                    rows={4}
                    value={form.excludes}
                    onChange={(e) => setForm({ ...form, excludes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={form.wheelchair_accessible}
                    onCheckedChange={(v) => setForm({ ...form, wheelchair_accessible: v })}
                  />
                  Wheelchair accessible
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={form.is_published}
                    onCheckedChange={(v) => setForm({ ...form, is_published: v })}
                  />
                  Published
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={save.isPending}
              onClick={() => form && save.mutate(form)}
            >
              Save excursion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addonsFor !== null} onOpenChange={(o) => (o ? null : setAddonsFor(null))}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add-ons — {addonsFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAddonForm({
                  excursion_id: addonsFor!.id,
                  name: "",
                  description: "",
                  price: "0",
                  currency: "EUR",
                  per_guest: false,
                  is_active: true,
                  sort_order: String((addons.data?.length ?? 0) + 1),
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> New add-on
            </Button>
          </div>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {(addons.data ?? []).length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">No add-ons yet.</li>
            ) : (
              (addons.data ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(a.price, a.currency)}
                      {a.per_guest ? " per guest" : " per booking"} · {a.is_active ? "Active" : "Hidden"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAddonForm({
                          id: a.id,
                          excursion_id: a.excursion_id,
                          name: a.name,
                          description: a.description ?? "",
                          price: String(a.price),
                          currency: a.currency,
                          per_guest: a.per_guest,
                          is_active: a.is_active,
                          sort_order: String(a.sort_order),
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeAddon.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={addonForm !== null} onOpenChange={(o) => (o ? null : setAddonForm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addonForm?.id ? "Edit add-on" : "New add-on"}</DialogTitle>
          </DialogHeader>
          {addonForm ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={addonForm.name}
                  onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={addonForm.price}
                    onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={addonForm.currency}
                    onChange={(e) => setAddonForm({ ...addonForm, currency: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={addonForm.sort_order}
                    onChange={(e) => setAddonForm({ ...addonForm, sort_order: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={addonForm.description}
                  onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={addonForm.per_guest}
                    onCheckedChange={(v) => setAddonForm({ ...addonForm, per_guest: v })}
                  />
                  Priced per guest
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={addonForm.is_active}
                    onCheckedChange={(v) => setAddonForm({ ...addonForm, is_active: v })}
                  />
                  Active
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddonForm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
              disabled={saveAddon.isPending}
              onClick={() => addonForm && saveAddon.mutate(addonForm)}
            >
              Save add-on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
