import { useState } from "react";
import { format } from "date-fns";
import {
  useListWorklogs,
  useListEmployees,
  useListClients,
  useUpdateWorklog,
  useDeleteWorklog,
  getListWorklogsQueryKey,
  getListEmployeesQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Trash2 } from "lucide-react";

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

export default function AdminWorkLogs() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const params = {
    date,
    ...(employeeId !== "all" ? { employeeId: parseInt(employeeId) } : {}),
    ...(status !== "all" ? { status: status as "done" | "pending" } : {}),
  };

  const { data: worklogs = [], isLoading } = useListWorklogs(params, {
    query: { queryKey: getListWorklogsQueryKey(params) },
  });

  const { data: employees = [] } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const updateWorklog = useUpdateWorklog();
  const deleteWorklog = useDeleteWorklog();

  const toggleStatus = async (id: number, current: string) => {
    await updateWorklog.mutateAsync({
      id,
      data: { status: current === "done" ? "pending" : "done" },
    });
    await queryClient.invalidateQueries({ queryKey: getListWorklogsQueryKey(params) });
  };

  const handleDelete = async (id: number) => {
    await deleteWorklog.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListWorklogsQueryKey(params) });
  };

  const doneCount = worklogs.filter((w) => w.status === "done").length;
  const pendingCount = worklogs.filter((w) => w.status === "pending").length;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Work Logs</h1>
        <p className="text-sm text-muted-foreground">All employee work submissions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-card border rounded-lg px-4 py-3">
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-sm w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-9 text-sm w-44">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.filter((e) => e.role !== "admin").map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-sm w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-sm"
          onClick={() => {
            setDate(format(new Date(), "yyyy-MM-dd"));
            setEmployeeId("all");
            setStatus("all");
          }}
        >
          Reset
        </Button>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-green-600 font-medium">{doneCount} done</span>
          <span className="text-amber-500 font-medium">{pendingCount} pending</span>
          <span className="text-muted-foreground">{worklogs.length} total</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : worklogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No work logs for the selected filters
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Work Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Notes</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {worklogs.map((wl) => (
                <tr key={wl.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{wl.employee.name}</td>
                  <td className="px-4 py-2.5">
                    <span>{wl.client.name}</span>
                    {wl.client.code && (
                      <span className="text-muted-foreground text-xs ml-1">({wl.client.code})</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="text-xs">
                      {WORK_TYPE_LABELS[wl.workType] || wl.workType}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleStatus(wl.id, wl.status)}>
                      {wl.status === "done" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full hover:bg-green-200">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hover:bg-amber-200">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-xs truncate">{wl.notes || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(wl.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
