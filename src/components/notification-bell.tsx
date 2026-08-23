import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { listMyNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listMyNotifications(),
    refetchInterval: 60_000,
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;

  async function markAllRead() {
    await markNotificationsRead({ data: {} });
    await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy-foreground/80 transition-colors hover:text-brass"
        >
          <Bell className="h-5 w-5" />
          {unread ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass px-1 text-[10px] font-medium text-brass-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="eyebrow text-brass">Notifications</p>
          {unread ? (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No updates yet. We'll write here whenever a reservation changes.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className={item.read_at ? "" : "bg-brass/5"}>
                  <Link
                    to={(item.href ?? "/account/bookings") as never}
                    className="block px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <p className="font-display text-base leading-tight">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
