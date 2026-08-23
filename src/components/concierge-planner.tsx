import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, MapPin, Users } from "lucide-react";
import {
  listPlanningSailings,
  recommendExcursions,
  recommendForMyVoyage,
} from "@/lib/recommend.functions";
import type { RecommendationResult } from "@/lib/recommend.server";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney, shortTime } from "@/lib/format";

const GOAL_PRESETS = [
  "Food and local markets, easy walking",
  "History and museums with skip-the-line",
  "Scenery and photos, gentle pace",
  "Family-friendly, back on board early",
];

/**
 * Goal-driven planner: the guest describes what they want, we return real
 * port / tour / day picks that link straight into the reservation flow.
 */
export function ConciergePlanner({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState("");
  const [party, setParty] = useState(2);
  const [sailingSlug, setSailingSlug] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sailings = useQuery({
    queryKey: ["planning-sailings"],
    queryFn: () => listPlanningSailings(),
    staleTime: 5 * 60_000,
  });

  async function plan(goalText: string) {
    const text = goalText.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        data: {
          goals: text,
          party,
          ...(sailingSlug ? { sailingSlug } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      };
      const data = user ? await recommendForMyVoyage(payload) : await recommendExcursions(payload);
      setResult(data);
    } catch {
      setError("I couldn't build suggestions just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
      <p className="text-muted-foreground">
        Tell me what you'd like from your day ashore and I'll pick real, bookable tours — with the
        port, day and time that fit.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          plan(goals);
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="goals">Your goals</Label>
          <Textarea
            id="goals"
            rows={3}
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
            placeholder="e.g. Turkish food, short walks, back on board by 4pm"
            className="mt-2"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setGoals(preset);
                  void plan(preset);
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-brass hover:text-brass"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="planSailing">Sailing (optional)</Label>
          <select
            id="planSailing"
            value={sailingSlug}
            onChange={(event) => setSailingSlug(event.target.value)}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
          >
            <option value="">{user ? "My next reservation's sailing" : "Any sailing"}</option>
            {(sailings.data ?? []).map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="planParty" className="text-xs">
              Guests
            </Label>
            <Input
              id="planParty"
              type="number"
              min={1}
              max={20}
              value={party}
              onChange={(event) => setParty(Number(event.target.value) || 1)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="planFrom" className="text-xs">
              From
            </Label>
            <Input
              id="planFrom"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="planTo" className="text-xs">
              To
            </Label>
            <Input
              id="planTo"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={busy || goals.trim().length < 3}
          className="w-full bg-brass text-brass-foreground hover:bg-brass-soft"
        >
          {busy ? "Planning your day…" : "Suggest tours"}
        </Button>
      </form>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          <div className="rule-brass" />
          <p className="font-display text-base leading-snug">{result.intro}</p>
          {result.suggestions.map((pick) => (
            <article
              key={pick.bookHref}
              className="overflow-hidden rounded-xl border border-border bg-ivory/40"
            >
              {pick.imageUrl ? (
                <img
                  src={pick.imageUrl}
                  alt={pick.excursionTitle}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
              ) : null}
              <div className="space-y-2 p-3">
                <p className="font-display text-base leading-tight">{pick.excursionTitle}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {pick.portName}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> {formatDate(pick.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {shortTime(pick.arrivalTime)} –{" "}
                    {shortTime(pick.departureTime)}
                  </span>
                </p>
                {pick.reason ? <p className="text-xs text-muted-foreground">{pick.reason}</p> : null}
                <p className="flex items-center gap-3 text-xs">
                  <span className="text-brass">
                    {formatMoney(pick.price, pick.currency)} per guest
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> {pick.seatsLeft} left
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    asChild
                    size="sm"
                    className="bg-navy-deep text-navy-foreground hover:bg-navy-deep/90"
                  >
                    <Link to={pick.bookHref as never} onClick={onNavigate}>
                      Reserve this
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to="/excursions/$slug"
                      params={{ slug: pick.excursionSlug }}
                      onClick={onNavigate}
                    >
                      Tour details
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
