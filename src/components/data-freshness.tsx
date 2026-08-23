import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relative(updatedAt: string) {
  const then = new Date(updatedAt).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (diff < HOUR) return rtf.format(-Math.max(1, Math.round(diff / MINUTE)), "minute");
  if (diff < DAY) return rtf.format(-Math.round(diff / HOUR), "hour");
  if (diff < 30 * DAY) return rtf.format(-Math.round(diff / DAY), "day");
  return rtf.format(-Math.round(diff / (30 * DAY)), "month");
}

export type FreshnessTier = "live" | "recent" | "stale";

export function freshnessTier(updatedAt: string | null | undefined): FreshnessTier {
  if (!updatedAt) return "stale";
  const diff = Date.now() - new Date(updatedAt).getTime();
  if (Number.isNaN(diff)) return "stale";
  if (diff < DAY) return "live";
  if (diff < 7 * DAY) return "recent";
  return "stale";
}

/** Hydration-safe relative timestamp: renders nothing until mounted. */
export function useRelativeTime(updatedAt: string | null | undefined) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!updatedAt) {
      setLabel(null);
      return;
    }
    setLabel(relative(updatedAt));
    const id = setInterval(() => setLabel(relative(updatedAt)), MINUTE);
    return () => clearInterval(id);
  }, [updatedAt]);
  return label;
}

function absolute(updatedAt: string | null | undefined) {
  if (!updatedAt) return undefined;
  const d = new Date(updatedAt);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleString();
}

const SOURCE_LABELS: Record<string, string> = {
  seed: "Shore Hopper reservations desk",
  manual: "Shore Hopper reservations desk",
  admin: "Shore Hopper reservations desk",
  firecrawl: "Cruise line timetable feed",
  import: "Cruise line timetable feed",
};

export function sourceLabel(source?: string | null) {
  if (!source) return null;
  return SOURCE_LABELS[source] ?? source;
}

/** Small inline "updated 2 hours ago" chip for list rows. */
export function FreshnessInline({
  updatedAt,
  className,
}: {
  updatedAt: string | null | undefined;
  className?: string;
}) {
  const label = useRelativeTime(updatedAt);
  const tier = freshnessTier(updatedAt);
  if (!label) return null;
  return (
    <span
      title={absolute(updatedAt)}
      className={cn(
        "inline-flex items-center gap-1 text-[0.7rem] tracking-wide",
        tier === "live" ? "text-sea" : tier === "recent" ? "text-muted-foreground" : "text-brass",
        className,
      )}
    >
      <RefreshCw className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/** Full-width freshness band for a sailing / port header. */
export function FreshnessBanner({
  updatedAt,
  source,
  refreshNote = "Timetables refresh automatically four times a day",
  className,
  tone = "light",
}: {
  updatedAt: string | null | undefined;
  source?: string | null;
  refreshNote?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const label = useRelativeTime(updatedAt);
  const tier = freshnessTier(updatedAt);
  const src = sourceLabel(source);

  const headline =
    tier === "live"
      ? "Timetable up to date"
      : tier === "recent"
        ? "Timetable last updated"
        : "Please re-confirm these times";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-4 py-2.5 text-xs",
        tone === "dark"
          ? "border-brass/30 bg-white/5 text-navy-foreground/80"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          tier === "stale" ? "text-brass" : tone === "dark" ? "text-brass" : "text-sea",
        )}
      >
        {tier === "stale" ? (
          <TriangleAlert className="size-3.5" aria-hidden />
        ) : (
          <CheckCircle2 className="size-3.5" aria-hidden />
        )}
        {headline}
      </span>
      {label ? <span title={absolute(updatedAt)}>{label}</span> : null}
      {src ? <span>· Source: {src}</span> : null}
      <span>· {refreshNote}</span>
      {tier === "stale" ? (
        <span className="text-brass">· Confirm arrival times with your ship's daily programme</span>
      ) : null}
    </div>
  );
}
