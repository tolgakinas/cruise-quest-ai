import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/cruises", label: "Find a cruise" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-navy-deep text-navy-foreground">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
        <BrandLogo />

        <nav className="hidden items-center gap-9 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm tracking-wide text-navy-foreground/80 transition-colors hover:text-brass"
              activeProps={{ className: "text-brass" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Button asChild variant="outline" className="border-brass/60 bg-transparent text-brass hover:bg-brass hover:text-brass-foreground">
              <Link to="/account">My voyage</Link>
            </Button>
          ) : (
            <Button asChild className="bg-brass text-brass-foreground hover:bg-brass-soft">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-navy-foreground md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-navy-deep text-navy-foreground">
            <div className="mt-10 flex flex-col gap-6">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} className="font-display text-xl">
                  {item.label}
                </Link>
              ))}
              <Link to={user ? "/account" : "/auth"} className="font-display text-xl text-brass">
                {user ? "My voyage" : "Sign in"}
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="rule-brass opacity-70" />
    </header>
  );
}
