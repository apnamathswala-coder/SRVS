import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import {
  useListAttendance,
  useListEmployees,
  useMarkAttendance,
  useUpdateAttendance,
  getListAttendanceQueryKey,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogIn, LogOut, Clock, Users, UserCheck, UserX } from "lucide-react";

type AttStatus = "present" | "absent" | "half-day" | "leave";

const STATUS_CONFIG: Record<AttStatus, { label: string; class: string }> = {
  "present": { label: "P", class: "bg-green-100 text-green-800 hover:bg-green-200" },
  "absent": { label: "A", class: "bg-red-100 text-red-800 hover:bg-red-200" },
  "half-day": { label: "H", class: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  "leave": { label: "L", class: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
};

const STATUS_CYCLE: AttStatus[] = ["present", "absent", "half-day", "leave"];

export default function AdminAttendance() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [view, setView] = useState<"live" | "monthly">("live");

  const monthParams = { month };
  const dailyParams = { date: selectedDate };

  const { data: monthAttendance = [] } = useListAttendance(monthParams, {
    query: { queryKey: getListAttendanceQueryKey(monthParams) },
  });

  const { data: dailyAttendance = [] } = useListAttendance(dailyParams, {
    query: {
      queryKey: getListAttendanceQueryKey(dailyParams),
      refetchInterval: selectedDate === format(new Date(), "yyyy-MM-dd") && view === "live" ? 5000 : false,
    },
  });

  const { data: employees = [] } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const markAttendance = useMarkAttendance();
  const updateAttendance = useUpdateAttendance();

  const activeEmployees = employees.filter((e) => e.isActive && e.role !== "admin");

  const handleMarkAttendance = async (employeeId: number, date: string, status: AttStatus) => {
    const existing = dailyAttendance.find(
      (a) => a.employeeId === employeeId && a.date === date
    );
    if (existing) {
      await updateAttendance.mutateAsync({ id: existing.id, data: { status } });
    } else {
      await markAttendance.mutateAsync({ data: { employeeId, date, status } });
    }
    await queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(dailyParams) });
    await queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(monthParams) });
  };

  const cycleStatus = async (employeeId: number, date: string, currentStatus?: string) => {
    const currentIndex = currentStatus ? STATUS_CYCLE.indexOf(currentStatus as AttStatus) : -1;
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    await handleMarkAttendance(employeeId, date, nextStatus);
  };

  const getDaysInMonth = () => {
    const [year, monthNum] = month.split("-").map(Number);
    const start = startOfMonth(new Date(year, monthNum - 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  };

  const getAttendanceStatus = (employeeId: number, date: string) => {
    return monthAttendance.find((a) => a.employeeId === employeeId && a.date === date)?.status;
  };

  type EmpRow = {
    employee: typeof activeEmployees[number];
    record: typeof dailyAttendance[number] | undefined;
    state: "in" | "out" | "off";
  };

  const rows: EmpRow[] = activeEmployees.map((emp) => {
    const record = dailyAttendance.find((a) => a.employeeId === emp.id);
    let state: "in" | "out" | "off" = "off";
    if (record?.punchInAt && !record.punchOutAt) state = "in";
    else if (record?.punchInAt && record?.punchOutAt) state = "out";
    return { employee: emp, record, state };
  });

  const punchedInCount = rows.filter((r) => r.state === "in").length;
  const punchedOutCount = rows.filter((r) => r.state === "out").length;
  const notPunchedCount = rows.filter((r) => r.state === "off").length;

  const recentEvents = rows
    .flatMap((r) => {
      const events: Array<{ key: string; emp: string; type: "in" | "out"; at: string }> = [];
      if (r.record?.punchInAt) events.push({ key: `in-${r.record.id}`, emp: r.employee.name, type: "in", at: r.record.punchInAt });
      if (r.record?.punchOutAt) events.push({ key: `out-${r.record.id}`, emp: r.employee.name, type: "out", at: r.record.punchOutAt });
      return events;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Live punch tracking and monthly overview.</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "live" ? "default" : "outline"}
            onClick={() => setView("live")}
            className="h-9 text-sm"
          >
            Live View
          </Button>
          <Button
            size="sm"
            variant={view === "monthly" ? "default" : "outline"}
            onClick={() => setView("monthly")}
            className="h-9 text-sm"
          >
            Monthly View
          </Button>
        </div>
      </div>

      {view === "live" ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 text-sm w-40"
              />
            </div>
            {selectedDate === format(new Date(), "yyyy-MM-dd") && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live · refreshes every 5s
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Currently In" value={punchedInCount} icon={LogIn} color="text-green-600 bg-green-50 border-green-200" />
            <StatCard label="Punched Out" value={punchedOutCount} icon={LogOut} color="text-red-600 bg-red-50 border-red-200" />
            <StatCard label="Not Punched" value={notPunchedCount} icon={UserX} color="text-muted-foreground bg-muted/40 border-border" />
            <StatCard label="Total Active" value={activeEmployees.length} icon={Users} color="text-blue-600 bg-blue-50 border-blue-200" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground mb-2">Employee Status</h2>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">State</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Punch In</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Punch Out</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Worked</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Mark As</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map(({ employee: emp, record, state }) => {
                        const currentStatus = record?.status;
                        return (
                          <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                            <td className="px-4 py-3"><LiveStateBadge state={state} status={currentStatus as AttStatus | undefined} /></td>
                            <td className="px-4 py-3 text-xs"><PunchTime iso={record?.punchInAt} /></td>
                            <td className="px-4 py-3 text-xs"><PunchTime iso={record?.punchOutAt} /></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {record?.punchInAt ? durationStr(record.punchInAt, record.punchOutAt) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {STATUS_CYCLE.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => handleMarkAttendance(emp.id, selectedDate, s)}
                                    title={s}
                                    className={cn(
                                      "w-7 h-7 rounded text-xs font-medium transition-colors border",
                                      currentStatus === s
                                        ? STATUS_CONFIG[s].class + " border-transparent"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    {STATUS_CONFIG[s].label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Recent Activity
              </h2>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  {recentEvents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No punch activity yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {recentEvents.map((ev) => (
                        <li key={ev.key} className="px-4 py-2.5 flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                            ev.type === "in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600",
                          )}>
                            {ev.type === "in" ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{ev.emp}</p>
                            <p className="text-xs text-muted-foreground">
                              Punched {ev.type === "in" ? "in" : "out"} · {format(new Date(ev.at), "h:mm a")}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className={cn("w-5 h-5 rounded text-center text-xs font-medium flex items-center justify-center", v.class)}>{v.label}</span>
                    <span className="capitalize">{k.replace("-", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 text-sm w-40"
            />
          </div>

          <Card className="overflow-auto">
            <CardContent className="p-0 overflow-x-auto">
              <div className="overflow-x-auto">
                <table className="text-xs min-w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/50 min-w-32">Employee</th>
                      {getDaysInMonth().map((day) => (
                        <th
                          key={day.toISOString()}
                          className="px-1.5 py-2.5 font-medium text-muted-foreground text-center min-w-8"
                        >
                          <div>{format(day, "d")}</div>
                          <div className="text-muted-foreground/60">{format(day, "EEE").charAt(0)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium sticky left-0 bg-card">{emp.name}</td>
                        {getDaysInMonth().map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const attStatus = getAttendanceStatus(emp.id, dateStr);
                          const config = attStatus ? STATUS_CONFIG[attStatus as AttStatus] : null;
                          return (
                            <td key={dateStr} className="px-1 py-2.5 text-center">
                              <button
                                onClick={() => cycleStatus(emp.id, dateStr, attStatus)}
                                className={cn(
                                  "w-7 h-7 rounded text-xs font-medium transition-colors flex items-center justify-center mx-auto",
                                  config ? config.class : "text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                {config ? config.label : "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className={cn("border", color.split(" ").filter((c) => c.startsWith("border-")).join(" "))}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-md flex items-center justify-center", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveStateBadge({ state, status }: { state: "in" | "out" | "off"; status?: AttStatus }) {
  if (state === "in") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Punched In
      </span>
    );
  }
  if (state === "out") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
        <UserCheck className="w-3 h-3" />
        Punched Out
      </span>
    );
  }
  if (status) {
    const config = STATUS_CONFIG[status];
    const fullLabels: Record<AttStatus, string> = {
      present: "Present", absent: "Absent", "half-day": "Half Day", leave: "Leave",
    };
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", config.class)}>
        {fullLabels[status]}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Not marked</span>;
}

function PunchTime({ iso }: { iso?: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = new Date(iso);
  return (
    <span className="font-medium text-foreground">
      {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function durationStr(inIso: string, outIso: string | null | undefined) {
  const end = outIso ? new Date(outIso).getTime() : Date.now();
  const ms = end - new Date(inIso).getTime();
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m${outIso ? "" : " (live)"}`;
}
