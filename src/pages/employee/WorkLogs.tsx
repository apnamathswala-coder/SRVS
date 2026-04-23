import { useState } from "react";
import { useListWorklogs, useUpdateWorklog, getListWorklogsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

export default function EmployeeWorkLogs() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const params = { date };
  const { data: worklogs = [], isLoading } = useListWorklogs(params, {
    query: { queryKey: getListWorklogsQueryKey(params) },
  });

  const updateWorklog = useUpdateWorklog();

  const toggleStatus = async (id: number, currentStatus: string) => {
    await updateWorklog.mutateAsync({
      id,
      data: { status: currentStatus === "done" ? "pending" : "done" },
    });
    await queryClient.invalidateQueries({ queryKey: getListWorklogsQueryKey(params) });
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Work Logs</h1>
        <p className="text-sm text-muted-foreground">View and manage your submitted work entries</p>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-sm w-44"
          />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((d) => {
            const dt = format(subDays(new Date(), d), "yyyy-MM-dd");
            const label = d === 0 ? "Today" : d === 1 ? "Yesterday" : format(subDays(new Date(), d), "EEE");
            return (
              <Button
                key={d}
                size="sm"
                variant={date === dt ? "default" : "outline"}
                onClick={() => setDate(dt)}
                className="h-9 text-xs"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : worklogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No work entries for {format(new Date(date + "T00:00:00"), "d MMMM yyyy")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {worklogs.map((wl) => (
            <Card key={wl.id} className="shadow-none">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground">{wl.client.name}</p>
                      {wl.client.code && (
                        <span className="text-xs text-muted-foreground">({wl.client.code})</span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {WORK_TYPE_LABELS[wl.workType] || wl.workType}
                      </Badge>
                    </div>
                    {wl.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{wl.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleStatus(wl.id, wl.status)}
                    className="shrink-0 mt-0.5"
                  >
                    {wl.status === "done" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full hover:bg-green-200 transition-colors">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
