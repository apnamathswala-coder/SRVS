import { useRef, useState } from "react";
import { format } from "date-fns";
import {
  useGetDashboardSummary,
  useGetWorktypeBreakdown,
  useGetEmployeeProductivity,
  useGetRecentTaskStatusChanges,
  useGetRecentPunches,
  getGetDashboardSummaryQueryKey,
  getGetWorktypeBreakdownQueryKey,
  getGetEmployeeProductivityQueryKey,
  getGetRecentTaskStatusChangesQueryKey,
  getGetRecentPunchesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, CheckCircle2, Clock, CalendarCheck, ClipboardList, LogIn, LogOut, Loader2, Activity } from "lucide-react";
import AssignTaskDialog from "@/components/AssignTaskDialog";

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

export default function AdminDashboard() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const dateParam = { date };

  const { data: summary } = useGetDashboardSummary(dateParam, {
    query: { queryKey: getGetDashboardSummaryQueryKey(dateParam) },
  });

  const { data: breakdown = [] } = useGetWorktypeBreakdown(dateParam, {
    query: { queryKey: getGetWorktypeBreakdownQueryKey(dateParam) },
  });

  const { data: productivity = [] } = useGetEmployeeProductivity(dateParam, {
    query: { queryKey: getGetEmployeeProductivityQueryKey(dateParam) },
  });

  const sinceRef = useRef(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const sinceParam = { since: sinceRef.current };
  const { data: recentStatus = [] } = useGetRecentTaskStatusChanges(sinceParam, {
    query: {
      queryKey: getGetRecentTaskStatusChangesQueryKey(sinceParam),
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    },
  });
  const { data: recentPunches = [] } = useGetRecentPunches(sinceParam, {
    query: {
      queryKey: getGetRecentPunchesQueryKey(sinceParam),
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    },
  });

  type FeedItem = {
    key: string;
    at: Date;
    kind: "status-done" | "status-working" | "status-pending" | "punch-in" | "punch-out";
    who: string;
    text: string;
    sub?: string;
  };

  const feed: FeedItem[] = [];
  for (const t of recentStatus as Array<{
    id: number;
    title: string;
    status: string;
    statusChangedAt?: string | null;
    assignedTo?: { name?: string };
    client?: { name?: string } | null;
  }>) {
    if (!t.statusChangedAt) continue;
    const kind: FeedItem["kind"] =
      t.status === "done" ? "status-done" : t.status === "working" ? "status-working" : "status-pending";
    const action = t.status === "done" ? "marked Done" : t.status === "working" ? "started Working on" : "moved to Pending";
    feed.push({
      key: `s-${t.id}-${t.statusChangedAt}`,
      at: new Date(t.statusChangedAt),
      kind,
      who: t.assignedTo?.name ?? "Employee",
      text: `${action}: ${t.title}`,
      sub: t.client?.name ?? undefined,
    });
  }
  for (const p of recentPunches as Array<{
    id: number;
    punchInAt?: string | null;
    punchOutAt?: string | null;
    employee?: { name?: string };
  }>) {
    const name = p.employee?.name ?? "Employee";
    if (p.punchInAt) {
      feed.push({
        key: `pi-${p.id}`,
        at: new Date(p.punchInAt),
        kind: "punch-in",
        who: name,
        text: `Punched in at ${format(new Date(p.punchInAt), "h:mm a")}`,
      });
    }
    if (p.punchOutAt) {
      feed.push({
        key: `po-${p.id}`,
        at: new Date(p.punchOutAt),
        kind: "punch-out",
        who: name,
        text: `Punched out at ${format(new Date(p.punchOutAt), "h:mm a")}`,
      });
    }
  }
  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  const feedTop = feed.slice(0, 30);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Office overview and daily summary</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">View Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-sm w-44"
            />
          </div>
          <AssignTaskDialog />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Worklogs"
          value={summary?.totalWorklogs ?? 0}
          icon={<ClipboardList className="w-4 h-4 text-blue-500" />}
          color="blue"
        />
        <StatCard
          label="Completed"
          value={summary?.doneCount ?? 0}
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          color="green"
        />
        <StatCard
          label="Pending"
          value={summary?.pendingCount ?? 0}
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          color="amber"
        />
        <StatCard
          label="Present Today"
          value={summary?.presentToday ?? 0}
          icon={<CalendarCheck className="w-4 h-4 text-purple-500" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Employees"
          value={summary?.totalEmployees ?? 0}
          icon={<Users className="w-4 h-4 text-indigo-500" />}
          color="indigo"
        />
        <StatCard
          label="Active Employees"
          value={summary?.activeEmployees ?? 0}
          icon={<Users className="w-4 h-4 text-teal-500" />}
          color="teal"
        />
        <StatCard
          label="Absent Today"
          value={summary?.absentToday ?? 0}
          icon={<Users className="w-4 h-4 text-red-400" />}
          color="red"
        />
        <StatCard
          label="Total Clients"
          value={summary?.totalClients ?? 0}
          icon={<Building2 className="w-4 h-4 text-orange-500" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Work type breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Work Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No data for this date</p>
            ) : (
              <div className="space-y-2">
                {breakdown.map((item) => (
                  <div key={item.workType} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground w-28 shrink-0">
                      {WORK_TYPE_LABELS[item.workType] || item.workType}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.round((item.doneCount / item.count) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-green-600 font-medium">{item.doneCount}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee productivity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Employee Productivity</CardTitle>
          </CardHeader>
          <CardContent>
            {productivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No data for this date</p>
            ) : (
              <div className="space-y-3">
                {productivity.map((emp) => (
                  <div key={emp.employeeId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{emp.employeeName}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-green-600 font-medium">{emp.doneTasks} done</span>
                        <span className="text-xs text-muted-foreground">/</span>
                        <span className="text-xs font-medium">{emp.totalTasks} total</span>
                      </div>
                    </div>
                    <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: emp.totalTasks ? `${Math.round((emp.doneTasks / emp.totalTasks) * 100)}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live activity feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Live Activity
            <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
              Last 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedTop.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
          ) : (
            <div className="divide-y">
              {feedTop.map((it) => {
                const accent = (() => {
                  switch (it.kind) {
                    case "punch-in":
                      return { icon: <LogIn className="w-3.5 h-3.5 text-green-600" />, label: "text-green-700" };
                    case "punch-out":
                      return { icon: <LogOut className="w-3.5 h-3.5 text-red-600" />, label: "text-red-700" };
                    case "status-done":
                      return { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />, label: "text-green-700" };
                    case "status-working":
                      return { icon: <Loader2 className="w-3.5 h-3.5 text-blue-600" />, label: "text-blue-700" };
                    default:
                      return { icon: <Clock className="w-3.5 h-3.5 text-amber-600" />, label: "text-amber-700" };
                  }
                })();
                return (
                  <div key={it.key} className="flex items-start gap-2.5 py-2">
                    <div className="mt-0.5">{accent.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className={`font-semibold ${accent.label}`}>{it.who}</span>{" "}
                        <span className="text-muted-foreground">{it.text}</span>
                      </p>
                      {it.sub && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium mt-0.5">
                          {it.sub}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                      {format(it.at, "h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    amber: "bg-amber-50 border-amber-100",
    purple: "bg-purple-50 border-purple-100",
    indigo: "bg-indigo-50 border-indigo-100",
    teal: "bg-teal-50 border-teal-100",
    red: "bg-red-50 border-red-100",
    orange: "bg-orange-50 border-orange-100",
  };

  return (
    <Card className={`shadow-none ${colorMap[color] || ""}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
