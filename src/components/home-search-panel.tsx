import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Ship, MapPin } from "lucide-react";
import { getSearchFacets } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ANY = "__any";

export function HomeSearchPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"cruise" | "port">("cruise");
  const [line, setLine] = useState(ANY);
  const [ship, setShip] = useState(ANY);
  const [from, setFrom] = useState("");
  const [port, setPort] = useState(ANY);

  const facets = useQuery({ queryKey: ["facets"], queryFn: () => getSearchFacets() });

  const ships = useMemo(() => {
    const all = facets.data?.ships ?? [];
    if (line === ANY) return all;
    const selected = (facets.data?.cruiseLines ?? []).find((l) => l.slug === line);
    return selected ? all.filter((s) => s.cruise_line_id === selected.id) : all;
  }, [facets.data, line]);

  function submit() {
    if (tab === "port") {
      if (port !== ANY) {
        void navigate({ to: "/ports/$slug", params: { slug: port } });
        return;
      }
      void navigate({ to: "/cruises", search: {} });
      return;
    }
    void navigate({
      to: "/cruises",
      search: {
        ...(line !== ANY ? { line } : {}),
        ...(ship !== ANY ? { ship } : {}),
        ...(from ? { from } : {}),
      },
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xl md:p-7">
      <div className="flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setTab("cruise")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 transition-colors",
            tab === "cruise" ? "bg-navy-deep text-navy-foreground" : "text-muted-foreground",
          )}
        >
          <Ship className="size-3.5" /> By cruise
        </button>
        <button
          type="button"
          onClick={() => setTab("port")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 transition-colors",
            tab === "port" ? "bg-navy-deep text-navy-foreground" : "text-muted-foreground",
          )}
        >
          <MapPin className="size-3.5" /> By port
        </button>
      </div>

      {tab === "cruise" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div>
            <Label className="eyebrow text-muted-foreground">Cruise line</Label>
            <Select
              value={line}
              onValueChange={(v) => {
                setLine(v);
                setShip(ANY);
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Any line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any line</SelectItem>
                {(facets.data?.cruiseLines ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.slug}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="eyebrow text-muted-foreground">Ship</Label>
            <Select value={ship} onValueChange={setShip}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Any ship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any ship</SelectItem>
                {ships.map((s) => (
                  <SelectItem key={s.id} value={s.slug}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="eyebrow text-muted-foreground">Sailing date from</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} className="w-full bg-aqua text-aqua-foreground hover:bg-aqua-deep">
              <Search className="mr-2 size-4" /> Find excursions
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-3">
            <Label className="eyebrow text-muted-foreground">Port of call</Label>
            <Select value={port} onValueChange={setPort}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose a port" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All ports</SelectItem>
                {(facets.data?.ports ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.name}, {p.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={submit} className="w-full bg-aqua text-aqua-foreground hover:bg-aqua-deep">
              <Search className="mr-2 size-4" /> See tours
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
