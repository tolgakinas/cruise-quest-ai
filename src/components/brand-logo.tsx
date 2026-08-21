import { Link } from "@tanstack/react-router";
import logo from "@/assets/shore-hopper-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  imgClassName,
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <Link to="/" className={cn("inline-flex items-center", className)} aria-label="Shore Hopper">
      <img
        src={logo.url}
        alt="Shore Hopper"
        width={200}
        height={56}
        className={cn("h-11 w-auto object-contain", imgClassName)}
      />
    </Link>
  );
}
