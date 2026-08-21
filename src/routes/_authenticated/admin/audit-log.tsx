import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Search } from "lucide-react";
import { getAuditLog } from "@/lib/audit.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — Shore Hopper Admin" },
      {
        name: "description",
        content:
          "Admin audit trail of Shore Hopper activity: sailings published, excursions created and refunds processed.",
      },
      { property: "og:title", content: "Audit Log — Shore Hopper Admin" },
      {
        property: "og:description",
        content: "Track publishing, catalogue changes and refunds across Shore Hopper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditLogPage,
});

const ENTITY_TYPES = ["sailing", "excursion", "booking", "payment"] as const;

const ACTIONS = [
  "sailing.published",
  "sailing.unpublished",
  "sailing.created",
  "excursion.created",
  "excursion.published",
  "booking.refunded",
  "booking.cancelled",
  "booking.confirmed",
  "payment.refunded",
  "payment.paid",
] as const;

const ALL = "all";

function actionTone(action: string) {
  if (action.endsWith(".refunded")) return "border-destructive/40 text-destructive";
  if (action.endsWith(".published") || action.endsWith(".paid") || action.endsWith(".confirmed"))
    return "border-brass/60 text-brass";
  if (action.endsWith(".deleted") || action.endsWith(".cancelled") || action.endsWith(".failed"))
    return "border-muted-foreground/40 text-muted-foreground";
  return "border-foreground/25 text-foreground";
}

function AuditLogPage() {
  const { isAdmin, checking } = useIsAdmin();
  const fetchLog = useServerFn(getAuditLog);

  const [entityType, setEntityType] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const filters = useMemo(
    () => ({
      entityType: entityType === ALL ? null : entityType,
      action: action === ALL ? null : action,
      q: q.trim() ? q.trim() : null,
      limit: 100,
    }),
    [entityType, action, q],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn: () => fetchLog({ data: filters }),
    enabled: isAdmin,
  });

  if (checking) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="eyebrow text-brass">Restricted</p>
        <h1 className="mt-3 text-4xl">Admin access only</h1>
        <p className="mt-4 text-muted-foreground">
          This audit trail is reserved for Shore Hopper administrators.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/account">Back to my voyage</Link>
        </Button>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow text-brass">Administration</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl">
        <ShieldCheck className="size-7 text-brass" aria-hidden />
        Audit log
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Every publish, catalogue change, booking status change and refund is recorded here with the
        administrator responsible.
      </p>
      <div className="rule-brass mt-8" />

      <dl className="mt-10 grid gap-5 sm:grid-cols-4">
        {[
          { label: "Entries shown", value: stats?.total },
          { label: "Publishes", value: stats?.published },
          { label: "Records created", value: stats?.created },
          { label: "Refunds", value: stats?.refunded },
        ].map((card) => (
          <div key={card.label} className="border border-border/70 p-5">
            <dt className="eyebrow text-muted-foreground">{card.label}</dt>
            <dd className="mt-2 font-display text-3xl">{card.value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      <form
        className="mt-10 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
        }}
      >
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search summary or administrator email"
            aria-label="Search audit entries"
            className="pl-9"
          />
        </div>

        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44" aria-label="Filter by record type">
            <SelectValue placeholder="Record type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All record types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-56" aria-label="Filter by action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" className="bg-brass text-brass-foreground hover:bg-brass-soft">
          Apply
        </Button>
      </form>

      <div className="mt-8 border border-border/70">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-destructive">
            {error instanceof Error ? error.message : "Unable to load the audit log."}
          </p>
        ) : (data?.entries.length ?? 0) === 0 ? (
          <p className="p-6 text-muted-foreground">No audit entries match these filters yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">When</TableHead>
                <TableHead className="w-52">Action</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="w-56">Administrator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={actionTone(entry.action)}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="block">{entry.summary}</span>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {entry.entity_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actor_name || entry.actor_email || "System"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
