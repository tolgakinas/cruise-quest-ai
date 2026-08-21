import { Link } from "@tanstack/react-router";
import { BrandLogo } from "./brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-navy-deep text-navy-foreground">
      <div className="rule-brass opacity-70" />
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-14 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <BrandLogo imgClassName="h-10 w-auto" />
          <p className="mt-5 text-sm leading-relaxed text-navy-foreground/70">
            Sailings, port calls and shore excursions, arranged with the precision of a ship's
            timetable.
          </p>
        </div>

        <div className="flex gap-16">
          <nav className="flex flex-col gap-3 text-sm text-navy-foreground/70">
            <span className="eyebrow text-brass">Explore</span>
            <Link to="/cruises" className="transition-colors hover:text-brass">
              Find a cruise
            </Link>
            <Link to="/about" className="transition-colors hover:text-brass">
              About
            </Link>
            <Link to="/contact" className="transition-colors hover:text-brass">
              Contact
            </Link>
          </nav>
          <nav className="flex flex-col gap-3 text-sm text-navy-foreground/70">
            <span className="eyebrow text-brass">Account</span>
            <Link to="/auth" className="transition-colors hover:text-brass">
              Sign in
            </Link>
            <Link to="/account" className="transition-colors hover:text-brass">
              My voyage
            </Link>
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl border-t border-navy-foreground/10 px-5 py-6 text-xs tracking-wide text-navy-foreground/50">
        © {new Date().getFullYear()} Shore Hopper. All rights reserved.
      </div>
    </footer>
  );
}
