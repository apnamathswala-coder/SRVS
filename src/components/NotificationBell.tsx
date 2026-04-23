import { useMemo, useState } from "react";
import {
  useGetRecentPunches,
  useGetRecentTaskStatusChanges,
  getGetRecentPunchesQueryKey,
  getGetRecentTaskStatusChangesQueryKey,
} from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, LogIn, LogOut, CheckCircle2, Loader2, Clock, ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const LOOKBACK_HOURS = 24;
const READ_KEY = "ca-office:admin-bell-read-at";

type Entry = {
  key: string;
  at: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
};

function readReadAt(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(READ_KEY);
  if (!v) return 0;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function writeReadAt(iso: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, iso);
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readAt, setReadAt] = useState<number>(() => readReadAt());

  const since = useMemo(
    () => new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
    [],
  );

  const punchKey = getGetRecentPunchesQueryKey({ since });
  const { data: punchData } = useGetRecentPunches(
    { since },
    { query: { queryKey: punchKey, refetchInterval: 5000 } },
  );

  const statusKey = getGetRecentTaskStatusChangesQueryKey({ since });
  const { data: statusData } = useGetRecentTaskStatusChanges(
    { since },
    { query: { queryKey: statusKey, refetchInterval: 5000 } },
  );

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];

    const punches = (punchData ?? []) as Array<{
      id: number;
      punchInAt?: string | null;
      punchOutAt?: string | null;
      employee?: { name?: string };
    }>;
    for (const p of punches) {
      const name = p.employee?.name ?? "Employee";
      if (p.punchInAt) {
        list.push({
          key: `in-${p.id}`,
          at: p.punchInAt,
          icon: <LogIn className="w-4 h-4 text-green-600" />,
          title: `${name} punched in`,
          subtitle: new Date(p.punchInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
      if (p.punchOutAt) {
        list.push({
          key: `out-${p.id}`,
          at: p.punchOutAt,
          icon: <LogOut className="w-4 h-4 text-red-600" />,
          title: `${name} punched out`,
          subtitle: new Date(p.punchOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }

    const statuses = (statusData ?? []) as Array<{
      id: number;
      title: string;
      status: string;
      statusChangedAt?: string | null;
      assignedTo?: { name?: string };
    }>;
    for (const t of statuses) {
      if (!t.statusChangedAt) continue;
      const empName = t.assignedTo?.name ?? "Employee";
      const icon =
        t.status === "done" ? <CheckCircle2 className="w-4 h-4 text-green-600" />
        : t.status === "working" ? <Loader2 className="w-4 h-4 text-blue-600" />
        : t.status === "pending" ? <Clock className="w-4 h-4 text-amber-600" />
        : <ListChecks className="w-4 h-4 text-blue-600" />;
      const action =
        t.status === "done" ? "marked Done"
        : t.status === "working" ? "started Working on"
        : "moved to Pending";
      list.push({
        key: `status-${t.id}-${t.statusChangedAt}`,
        at: t.statusChangedAt,
        icon,
        title: `${empName} ${action}`,
        subtitle: t.title,
      });
    }

    list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return list.slice(0, 50);
  }, [punchData, statusData]);

  const unreadCount = useMemo(() => {
    return entries.reduce((acc, e) => (Date.parse(e.at) > readAt ? acc + 1 : acc), 0);
  }, [entries, readAt]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && entries.length > 0) {
      const newest = entries[0].at;
      writeReadAt(newest);
      setReadAt(Date.parse(newest));
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors text-foreground"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">Last {LOOKBACK_HOURS} hours</p>
        </div>
        {entries.length === 0 ? (
          <div className="py-8 px-4 text-center text-sm text-muted-foreground">
            No recent activity.
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              {entries.map((e) => {
                const isUnread = Date.parse(e.at) > readAt;
                return (
                  <div
                    key={e.key}
                    className={`flex items-start gap-2 px-3 py-2.5 ${isUnread ? "bg-blue-50/60" : ""}`}
                  >
                    <div className="mt-0.5 shrink-0">{e.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                      {e.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{e.subtitle}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                      </p>
                    </div>
                    {isUnread && <span className="w-1.5 h-1.5 mt-2 rounded-full bg-blue-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
