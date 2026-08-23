import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { getAdminCatalog, upsertPort, deletePort } from "@/lib/admin-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/ports")({
  head: () => ({
    meta: [
      { title: "Ports — Shore Hopper Admin" },
      { name: "description", content: "Manage port cities, descriptions and imagery." },
      { property: "og:title", content: "Ports — Shore Hopper Admin" },
      { property: "og:description", content: "Manage the port cities excursions are sold in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPortsPage,
});

type PortForm = {
  id?: string;
  name: string;
  country: string;
  region: string;
  description: string;
  image_url: string;
};

const empty: PortForm = { name: "", country: "", region: "", description: "", image_url: "" };

function AdminPortsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PortForm | null>(null);

  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });

  const save = useMutation({
    mutationFn: (input: PortForm) =>
      upsertPort({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          country: input.country,
          region: input.region,
          description: input.description,
          image_url: input.image_url,
        },
      }),
    onSuccess: async () => {
      toast.success("Port saved");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePort({ data: { id } }),
    onSuccess: async () => {
      toast.success("Port deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">Catalogue</p>
          <h1 className="mt-2 text-4xl">Ports</h1>
        </div>
        <Button className="bg-brass text-brass-foreground hover:bg-brass-soft" onClick={() => setForm(empty)}>
          <Plus className="mr-2 h-4 w-4" /> New port
        </Button>
      </div>
      <div className="rule-brass mt-6" />

      {catalog.isLoading ? (
        <Skeleton className="mt-8 h-72 w-full" />
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
          {(catalog.data?.ports ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-display text-lg">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.country}
                  {p.region ? ` · ${p.region}` : ""} · {p.source}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      country: p.country,
                      region: p.region ?? "",
                      description: p.description ?? "",
                      image_url: p.image_url ?? "",
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove.mutate(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => (open ? null : setForm(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit port" : "New port"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-country">Country</Label>
                  <Input
                    id="p-country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-region">Region</Label>
                  <Input
                    id="p-region"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-image">Image URL</Label>
                <Input
                  id="p-image"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
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
              Save port
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
