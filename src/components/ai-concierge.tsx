import { useEffect, useRef, useState } from "react";
import { Anchor, SendHorizonal, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { askConcierge, askConciergeAsGuest } from "@/lib/concierge.functions";
import { ConciergePlanner } from "@/components/concierge-planner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  content: string;
  links?: { label: string; href: string }[];
};

const OPENERS = [
  "Which tours are in Istanbul?",
  "What is the status of my reservation?",
  "Can I change my tour date?",
];

export function AiConcierge() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Welcome aboard. Ask me about a sailing, a port call, a shore excursion or your own reservations — I'll point you straight to the right page.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, open]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...turns, { role: "user" as const, content: text }];
    setTurns(history);
    setInput("");
    setBusy(true);
    try {
      const payload = {
        data: {
          messages: history
            .filter((t) => t.content)
            .map((t) => ({ role: t.role, content: t.content })),
        },
      };
      const result = user ? await askConciergeAsGuest(payload) : await askConcierge(payload);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, links: result.links },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the concierge desk. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Shore Hopper concierge"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brass text-brass-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Anchor className="h-6 w-6" />
        </button>
      ) : null}

      {open ? (
        <div className="fixed bottom-6 right-4 z-50 flex h-[560px] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-brass/40 bg-background shadow-2xl">
          <div className="flex items-center justify-between bg-navy-deep px-4 py-3 text-navy-foreground">
            <div className="flex items-center gap-2">
              <Anchor className="h-4 w-4 text-brass" />
              <span className="font-display text-lg">Concierge</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close concierge">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 border-b border-border text-xs">
            {(["ask", "plan"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={cn(
                  "px-3 py-2 uppercase tracking-widest transition-colors",
                  mode === tab
                    ? "border-b-2 border-brass text-brass"
                    : "text-muted-foreground hover:text-brass",
                )}
              >
                {tab === "ask" ? "Ask" : "Plan my day"}
              </button>
            ))}
          </div>

          {mode === "plan" ? (
            <ConciergePlanner onNavigate={() => setOpen(false)} />
          ) : (
            <>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            {turns.map((turn, index) => (
              <div key={index} className={turn.role === "user" ? "text-right" : ""}>
                <div
                  className={
                    turn.role === "user"
                      ? "inline-block max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-left"
                      : "rounded-2xl border border-border bg-ivory/50 px-3 py-2"
                  }
                >
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                  {turn.links?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {turn.links.map((link) => (
                        <Link
                          key={link.href + link.label}
                          to={link.href as never}
                          onClick={() => setOpen(false)}
                          className="rounded-full border border-brass/60 px-3 py-1 text-xs text-brass transition-colors hover:bg-brass hover:text-brass-foreground"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? <p className="text-xs text-muted-foreground">Consulting the itinerary…</p> : null}
            {turns.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {OPENERS.map((opener) => (
                  <button
                    key={opener}
                    type="button"
                    onClick={() => send(opener)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-brass hover:text-brass"
                  >
                    {opener}
                  </button>
                ))}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about ports, tours or your booking…"
              aria-label="Message the concierge"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy}
              className="bg-brass text-brass-foreground hover:bg-brass-soft"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
