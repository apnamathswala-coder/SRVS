import {
  useListTasks,
  useDeleteTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, CheckCircle2, Clock, Eye, EyeOff, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import AssignTaskDialog from "@/components/AssignTaskDialog";
import { cn } from "@/lib/utils";

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

type FilterStatus = "all" | "pending" | "working" | "done";

import { useState } from "react";

export default function AdminTasks() {
  const qc = useQueryClient();
  const tasksKey = getListTasksQueryKey();
  const { data: tasks = [] } = useListTasks(undefined, {
    query: { queryKey: tasksKey, refetchInterval: 5000 },
  });
  const [filter, setFilter] = useState<FilterStatus>("all");

  const deleteTask = useDeleteTask();

  const handleDelete = async (id: number) => {
    await deleteTask.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: tasksKey });
  };

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    working: tasks.filter((t) => t.status === "working").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  const visible = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live status from employees. Auto-refreshes every 5 seconds.
          </p>
        </div>
        <AssignTaskDialog />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "working", "done"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize",
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f} ({counts[f]})
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filter === "all" ? "No tasks yet. Click \"Assign Task\" to get started." : `No ${filter} tasks.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <Card key={t.id} className="shadow-none">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{t.title}</p>
                      <StatusBadge status={t.status} />
                      <SeenBadge seen={t.seen} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {t.client?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          {t.client.name}
                        </span>
                      )}
                      {t.workType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          {WORK_TYPE_LABELS[t.workType] || t.workType}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      To <span className="font-medium text-foreground">{t.assignedTo.name}</span>
                      <span className="mx-1.5">·</span>
                      Assigned by <span className="font-medium text-foreground">{t.assignedBy?.name ?? "Admin"}</span>
                      <span className="mx-1.5">·</span>
                      {format(new Date(t.createdAt), "d MMM, h:mm a")}
                      {t.statusChangedAt && (
                        <>
                          <span className="mx-1.5">·</span>
                          Updated {formatDistanceToNow(new Date(t.statusChangedAt), { addSuffix: true })}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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

function StatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Done
      </span>
    );
  }
  if (status === "working") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" /> Working
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

function SeenBadge({ seen }: { seen: boolean }) {
  return seen ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Eye className="w-3 h-3" /> Seen
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
      <EyeOff className="w-3 h-3" /> Unseen
    </span>
  );
}
