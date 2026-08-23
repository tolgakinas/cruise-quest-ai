import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudDownload, Plus, RefreshCw, Search, Ship, Trash2 } from "lucide-react";
import {
  getImportOverview,
  upsertImportSource,
  deleteImportSource,
  runTimetableImport,
  discoverImportUrls,
  discoverCruisemapper,
  runCruisemapperCatalogBatch,
  getCruisemapperStatus,
} from "@/lib/admin-import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/admin/imports")({
  head: () => ({
    meta: [
      { title: "Timetable imports — Shore Hopper Admin" },
      {
        name: "description",
        content: "Scrape cruise line timetables, dates and port call times into the Shore Hopper catalogue.",
      },
      { property: "og:title", content: "Timetable imports — Shore Hopper Admin" },
      {
        property: "og:description",
        content: "Manage automated cruise timetable scraping sources and review import runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminImportsPage,
});

type SourceForm = {
  id?: string;
  label: string;
  url: string;
  cruise_line_slug: string;
  is_active: boolean;
};

const emptyForm: SourceForm = { label: "", url: "", cruise_line_slug: "", is_active: true };

function AdminImportsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SourceForm | null>(null);
  const [adHocUrl, setAdHocUrl] = useState("");
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(15);

  const overview = useQuery({ queryKey: ["admin-imports"], queryFn: () => getImportOverview() });
  const cmStatus = useQuery({
    queryKey: ["admin-cruisemapper"],
    queryFn: () => getCruisemapperStatus(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-imports"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-cruisemapper"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
  };

  const discoverCatalog = useMutation({
    mutationFn: () => discoverCruisemapper({}),
    onSuccess: (res) => {
      toast.success(
        `${res.linesQueued} cruise lines and ${res.shipsQueued} ships found on CruiseMapper`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runBatch = useMutation({
    mutationFn: (limit: number) => runCruisemapperCatalogBatch({ data: { limit } }),
    onSuccess: (res) => {
      toast.success(
        `${res.processed} pages scraped — +${res.linesCreated} lines, +${res.shipsCreated} ships, +${res.sailingsCreated} sailings. ${res.remaining} pages still queued.`,
      );
      if (res.failed) toast.warning(`${res.failed} page(s) failed and were skipped`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const save = useMutation({
    mutationFn: (input: SourceForm) =>
      upsertImportSource({
        data: {
          ...(input.id ? { id: input.id } : {}),
          label: input.label,
          url: input.url,
          cruise_line_slug: input.cruise_line_slug,
          is_active: input.is_active,
        },
      }),
    onSuccess: () => {
      toast.success("Source saved");
      setForm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteImportSource({ data: { id } }),
    onSuccess: () => {
      toast.success("Source removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runImport = useMutation({
    mutationFn: (input: { sourceId?: string; url?: string }) => runTimetableImport({ data: input }),
    onSuccess: (stats) => {
      const total = stats.sailingsCreated + stats.sailingsUpdated;
      if (!total) toast.warning("No cruise timetable found on that page");
      else
        toast.success(
          `${stats.sailingsCreated} new and ${stats.sailingsUpdated} updated sailings, ${
            stats.portCallsCreated + stats.portCallsUpdated
          } port calls`,
        );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discover = useMutation({
    mutationFn: (url: string) => discoverImportUrls({ data: { url } }),
    onSuccess: (res) => {
      setDiscovered(res.urls);
      if (!res.urls.length) toast.warning("No itinerary pages found on that site");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sources = overview.data?.sources ?? [];
  const runs = overview.data?.runs ?? [];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">Cruise data</p>
          <h1 className="mt-2 font-display text-3xl">Timetable imports</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Scrape cruise line and itinerary pages to keep ships, sailing dates and port call
            arrival/departure times current. {overview.data?.importedSailings ?? 0} sailings currently
            come from imports.
          </p>
        </div>
        <Button
          onClick={() => setForm({ ...emptyForm })}
          className="bg-brass text-brass-foreground hover:bg-brass-soft"
        >
          <Plus className="mr-2 h-4 w-4" /> Add source
        </Button>
      </header>

      <section className="rounded-lg border border-brass/40 bg-brass/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl">
              <Ship className="h-5 w-5 text-brass" /> CruiseMapper full catalogue
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Discovery queues every cruise line and ship page on cruisemapper.com. Each batch
              scrapes the next queued pages — lines, ships and their sailing timetables with port
              call times. The scheduled refresh keeps working through the queue every six hours.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="batch" className="text-xs">
                Pages per batch
              </Label>
              <Input
                id="batch"
                type="number"
                min={1}
                max={40}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
                className="w-24"
              />
            </div>
            <Button
              variant="outline"
              disabled={discoverCatalog.isPending}
              onClick={() => discoverCatalog.mutate()}
            >
              <Search className="mr-2 h-4 w-4" />
              {discoverCatalog.isPending ? "Discovering…" : "Rediscover catalogue"}
            </Button>
            <Button
              disabled={runBatch.isPending}
              onClick={() => runBatch.mutate(batchSize)}
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
            >
              <CloudDownload className="mr-2 h-4 w-4" />
              {runBatch.isPending ? "Scraping…" : "Run a batch now"}
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Pages queued", value: cmStatus.data?.queued ?? 0 },
            { label: "Not scraped yet", value: cmStatus.data?.pending ?? 0 },
            { label: "Skipped pages", value: cmStatus.data?.givenUp ?? 0 },
            { label: "Cruise lines", value: cmStatus.data?.lines ?? 0 },
            { label: "Ships", value: cmStatus.data?.ships ?? 0 },
            { label: "Sailings", value: cmStatus.data?.sailings ?? 0 },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
              <dd className="font-display text-2xl">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {runBatch.data?.pages?.length ? (
          <ul className="mt-5 max-h-56 space-y-1 overflow-auto text-xs">
            {runBatch.data.pages.map((page, i) => (
              <li key={`${page.label}-${i}`} className="flex gap-2 border-b border-border/40 pb-1">
                <Badge variant={page.ok ? "default" : "destructive"} className="shrink-0">
                  {page.ok ? "ok" : "error"}
                </Badge>
                <span className="truncate">{page.label}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{page.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>


      <section className="rounded-lg border border-border/70 p-5">
        <h2 className="font-display text-xl">One-off scrape</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste any itinerary or schedule page. Use “Find itinerary pages” to list candidates from a
          cruise line’s site first.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={adHocUrl}
            onChange={(e) => setAdHocUrl(e.target.value)}
            placeholder="https://www.cruiseline.com/itineraries/mediterranean"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!adHocUrl || discover.isPending}
              onClick={() => discover.mutate(adHocUrl)}
            >
              <Search className="mr-2 h-4 w-4" /> Find itinerary pages
            </Button>
            <Button
              disabled={!adHocUrl || runImport.isPending}
              onClick={() => runImport.mutate({ url: adHocUrl })}
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
            >
              <CloudDownload className="mr-2 h-4 w-4" />
              {runImport.isPending ? "Importing…" : "Import now"}
            </Button>
          </div>
        </div>

        {discovered.length > 0 && (
          <ul className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
            {discovered.map((url) => (
              <li key={url} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <span className="truncate text-muted-foreground">{url}</span>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAdHocUrl(url)}>
                    Use
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runImport.isPending}
                    onClick={() => runImport.mutate({ url })}
                  >
                    Import
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl">Saved sources</h2>
        <div className="rule-brass mt-3" />
        {overview.isLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : sources.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No sources yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{source.label}</p>
                    <Badge variant={source.is_active ? "default" : "secondary"}>
                      {source.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{source.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last run:{" "}
                    {source.last_run_at ? new Date(source.last_run_at).toLocaleString() : "never"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runImport.isPending}
                    onClick={() => runImport.mutate({ sourceId: source.id })}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Run
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        id: source.id,
                        label: source.label,
                        url: source.url,
                        cruise_line_slug: source.cruise_line_slug ?? "",
                        is_active: source.is_active,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(source.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl">Recent runs</h2>
        <div className="rule-brass mt-3" />
        {overview.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : runs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No import runs recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Sailings</th>
                  <th className="py-2 pr-4">Port calls</th>
                  <th className="py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border/60">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{run.trigger}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={run.status === "success" ? "default" : run.status === "error" ? "destructive" : "secondary"}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      +{run.sailings_created} / ~{run.sailings_updated}
                    </td>
                    <td className="py-2 pr-4">
                      +{run.port_calls_created} / ~{run.port_calls_updated}
                    </td>
                    <td className="py-2 text-muted-foreground">{run.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit source" : "Add source"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Celestyal — Aegean itineraries"
                />
              </div>
              <div>
                <Label htmlFor="url">Page URL</Label>
                <Input
                  id="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label htmlFor="line">Cruise line hint (optional)</Label>
                <Input
                  id="line"
                  value={form.cruise_line_slug}
                  onChange={(e) => setForm({ ...form, cruise_line_slug: e.target.value })}
                  placeholder="Celestyal Cruises"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label htmlFor="active">Include in scheduled refresh</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              disabled={!form?.label || !form?.url || save.isPending}
              onClick={() => form && save.mutate(form)}
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
