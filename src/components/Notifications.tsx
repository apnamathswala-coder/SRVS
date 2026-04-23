import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetUnseenTasks,
  useGetRecentPunches,
  useGetRecentTaskStatusChanges,
  useMarkTaskSeen,
  getGetUnseenTasksQueryKey,
  getGetRecentPunchesQueryKey,
  getGetRecentTaskStatusChangesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ListChecks, LogIn, LogOut, X, CheckCircle2, Loader2, Clock } from "lucide-react";

const POPUP_DURATION_MS = 15000;

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

type Variant = "task" | "punch-in" | "punch-out" | "status-done" | "status-working" | "status-pending";

interface ToastItem {
  key: string;
  variant: Variant;
  title: string;
  subtitle?: string;
  body?: string;
  client?: string | null;
  workType?: string | null;
}

function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (key: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none">
      {items.map((item) => (
        <ToastCard key={item.key} item={item} onDismiss={() => onDismiss(item.key)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const accent = (() => {
    switch (item.variant) {
      case "punch-in":
        return { border: "border-l-green-500", icon: <LogIn className="w-4 h-4 text-green-600" />, label: "text-green-700" };
      case "punch-out":
        return { border: "border-l-red-500", icon: <LogOut className="w-4 h-4 text-red-600" />, label: "text-red-700" };
      case "status-done":
        return { border: "border-l-green-500", icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, label: "text-green-700" };
      case "status-working":
        return { border: "border-l-blue-500", icon: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />, label: "text-blue-700" };
      case "status-pending":
        return { border: "border-l-amber-500", icon: <Clock className="w-4 h-4 text-amber-600" />, label: "text-amber-700" };
      default:
        return { border: "border-l-blue-500", icon: <ListChecks className="w-4 h-4 text-blue-600" />, label: "text-blue-700" };
    }
  })();

  const variantLabel =
    item.variant === "task" ? "New Task"
    : item.variant === "punch-in" ? "Punch In"
    : item.variant === "punch-out" ? "Punch Out"
    : item.variant === "status-done" ? "Task Completed"
    : item.variant === "status-working" ? "Task Started"
    : "Task Reopened";

  return (
    <div
      className={`pointer-events-auto bg-card border border-l-4 ${accent.border} rounded-md shadow-lg p-3 animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{accent.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${accent.label}`}>
              {variantLabel}
            </p>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5">{item.title}</p>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
          )}
          {(item.client || item.workType) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.client && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {item.client}
                </span>
              )}
              {item.workType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                  {WORK_TYPE_LABELS[item.workType] || item.workType}
                </span>
              )}
            </div>
          )}
          {item.body && (
            <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line line-clamp-3">{item.body}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function useToastQueue() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    const t = timersRef.current.get(key);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(key);
    }
  }, []);

  const push = useCallback(
    (item: ToastItem) => {
      setItems((prev) => {
        if (prev.some((p) => p.key === item.key)) return prev;
        return [item, ...prev].slice(0, 5);
      });
      const timer = setTimeout(() => dismiss(item.key), POPUP_DURATION_MS);
      timersRef.current.set(item.key, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return { items, push, dismiss };
}

export default function Notifications() {
  const { employee } = useAuth();
  if (!employee) return null;
  return employee.role === "admin" ? <AdminNotifications /> : <EmployeeNotifications />;
}

function EmployeeNotifications() {
  const qc = useQueryClient();
  const key = getGetUnseenTasksQueryKey();
  const { data } = useGetUnseenTasks({ query: { queryKey: key, refetchInterval: 5000 } });
  const markSeen = useMarkTaskSeen();
  const handledRef = useRef<Set<number>>(new Set());
  const { items, push, dismiss } = useToastQueue();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const list = data as Array<{
      id: number;
      title: string;
      description?: string | null;
      workType?: string | null;
      client?: { name?: string } | null;
      assignedBy?: { name?: string };
    }>;
    for (const t of list) {
      if (handledRef.current.has(t.id)) continue;
      handledRef.current.add(t.id);
      push({
        key: `task-${t.id}`,
        variant: "task",
        title: t.title,
        subtitle: `From ${t.assignedBy?.name ?? "Admin"}`,
        body: t.description ?? undefined,
        client: t.client?.name ?? null,
        workType: t.workType ?? null,
      });
      markSeen
        .mutateAsync({ id: t.id })
        .then(() => qc.invalidateQueries({ queryKey: key }))
        .catch(() => {});
    }
  }, [data, markSeen, qc, key, push]);

  return <ToastStack items={items} onDismiss={dismiss} />;
}

const ADMIN_PUNCH_SINCE_KEY = "ca-office:admin-punch-since";
const ADMIN_STATUS_SINCE_KEY = "ca-office:admin-status-since";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

function readSince(key: string): string {
  if (typeof window === "undefined") return new Date().toISOString();
  const stored = window.localStorage.getItem(key);
  if (stored) {
    const t = Date.parse(stored);
    if (!isNaN(t)) {
      const cutoff = Date.now() - LOOKBACK_MS;
      return new Date(Math.max(t, cutoff)).toISOString();
    }
  }
  return new Date().toISOString();
}

function writeSince(key: string, iso: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, iso);
}

function AdminNotifications() {
  const sincePunchRef = useRef<string>(readSince(ADMIN_PUNCH_SINCE_KEY));
  const sinceStatusRef = useRef<string>(readSince(ADMIN_STATUS_SINCE_KEY));
  const seenInRef = useRef<Set<number>>(new Set());
  const seenOutRef = useRef<Set<number>>(new Set());
  // Map of taskId -> last status we've already notified about
  const lastStatusRef = useRef<Map<number, string>>(new Map());
  const { items, push, dismiss } = useToastQueue();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(ADMIN_PUNCH_SINCE_KEY)) {
      writeSince(ADMIN_PUNCH_SINCE_KEY, sincePunchRef.current);
    }
    if (!window.localStorage.getItem(ADMIN_STATUS_SINCE_KEY)) {
      writeSince(ADMIN_STATUS_SINCE_KEY, sinceStatusRef.current);
    }
  }, []);

  const punchKey = getGetRecentPunchesQueryKey({ since: sincePunchRef.current });
  const { data: punchData } = useGetRecentPunches(
    { since: sincePunchRef.current },
    { query: { queryKey: punchKey, refetchInterval: 2000, refetchIntervalInBackground: true } },
  );

  const statusKey = getGetRecentTaskStatusChangesQueryKey({ since: sinceStatusRef.current });
  const { data: statusData } = useGetRecentTaskStatusChanges(
    { since: sinceStatusRef.current },
    { query: { queryKey: statusKey, refetchInterval: 2000, refetchIntervalInBackground: true } },
  );

  useEffect(() => {
    if (!punchData) return;
    const list = punchData as Array<{
      id: number;
      punchInAt?: string | null;
      punchOutAt?: string | null;
      employee?: { name?: string };
    }>;

    let latest = sincePunchRef.current;
    for (const item of [...list].reverse()) {
      const name = item.employee?.name ?? "Employee";
      if (item.punchInAt && !seenInRef.current.has(item.id)) {
        seenInRef.current.add(item.id);
        push({
          key: `in-${item.id}`,
          variant: "punch-in",
          title: name,
          subtitle: `Punched in at ${new Date(item.punchInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        });
        if (item.punchInAt > latest) latest = item.punchInAt;
      }
      if (item.punchOutAt && !seenOutRef.current.has(item.id)) {
        seenOutRef.current.add(item.id);
        push({
          key: `out-${item.id}`,
          variant: "punch-out",
          title: name,
          subtitle: `Punched out at ${new Date(item.punchOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        });
        if (item.punchOutAt > latest) latest = item.punchOutAt;
      }
    }
    if (latest !== sincePunchRef.current) {
      writeSince(ADMIN_PUNCH_SINCE_KEY, latest);
    }
  }, [punchData, push]);

  useEffect(() => {
    if (!statusData) return;
    const list = statusData as Array<{
      id: number;
      title: string;
      status: string;
      statusChangedAt?: string | null;
      assignedTo?: { name?: string };
      client?: { name?: string } | null;
      workType?: string | null;
    }>;

    let latest = sinceStatusRef.current;
    for (const t of [...list].reverse()) {
      const prev = lastStatusRef.current.get(t.id);
      if (prev === t.status) continue;
      lastStatusRef.current.set(t.id, t.status);

      const empName = t.assignedTo?.name ?? "Employee";
      const variant: Variant =
        t.status === "done" ? "status-done" : t.status === "working" ? "status-working" : "status-pending";
      const action =
        t.status === "done" ? "marked Done" : t.status === "working" ? "started Working on" : "moved to Pending";

      push({
        key: `status-${t.id}-${t.statusChangedAt ?? t.status}`,
        variant,
        title: `${empName} ${action}`,
        subtitle: t.title,
        client: t.client?.name ?? null,
        workType: t.workType ?? null,
      });
      if (t.statusChangedAt && t.statusChangedAt > latest) latest = t.statusChangedAt;
    }
    if (latest !== sinceStatusRef.current) {
      writeSince(ADMIN_STATUS_SINCE_KEY, latest);
    }
  }, [statusData, push]);

  return <ToastStack items={items} onDismiss={dismiss} />;
}

