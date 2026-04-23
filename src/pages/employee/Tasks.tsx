import {
  useListTasks,
  useUpdateTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
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

type TaskStatus = "pending" | "working" | "done";

const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: string;
  idle: string;
}> = [
  { value: "pending", label: "Pending", icon: Clock, active: "bg-amber-100 text-amber-800 border-amber-300", idle: "border-border text-muted-foreground hover:bg-muted" },
  { value: "working", label: "Working", icon: Loader2, active: "bg-blue-100 text-blue-800 border-blue-300", idle: "border-border text-muted-foreground hover:bg-muted" },
  { value: "done", label: "Done", icon: CheckCircle2, active: "bg-green-100 text-green-800 border-green-300", idle: "border-border text-muted-foreground hover:bg-muted" },
];

export default function EmployeeTasks() {
  const qc = useQueryClient();
  const tasksKey = getListTasksQueryKey();
  const { data: tasks = [] } = useListTasks(undefined, {
    query: { queryKey: tasksKey, refetchInterval: 5000 },
  });
  const updateTask = useUpdateTask();

  const handleSetStatus = async (id: number, status: TaskStatus, current: string) => {
    if (status === current) return;
    await updateTask.mutateAsync({ id, data: { status } });
    await qc.invalidateQueries({ queryKey: tasksKey });
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const working = tasks.filter((t) => t.status === "working");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Assigned Tasks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tasks the admin has assigned to you. Update status as you progress — admin sees changes live.
        </p>
      </div>

      <Section title="Pending" tasks={pending} onSetStatus={handleSetStatus} emptyText="No pending tasks." />
      <Section title="Working" tasks={working} onSetStatus={handleSetStatus} emptyText="Nothing in progress." />
      <Section title="Completed" tasks={done} onSetStatus={handleSetStatus} emptyText="No completed tasks yet." />
    </div>
  );
}

function Section({
  title,
  tasks,
  onSetStatus,
  emptyText,
}: {
  title: string;
  tasks: Array<{
    id: number;
    title: string;
    description?: string | null;
    workType?: string | null;
    status: string;
    createdAt: string;
    statusChangedAt?: string | null;
    client?: { name?: string } | null;
    assignedBy?: { name?: string };
  }>;
  onSetStatus: (id: number, status: TaskStatus, current: string) => void;
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-2">
        {title} ({tasks.length})
      </h2>
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="shadow-none">
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
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
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line">
                        {t.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Assigned by{" "}
                      <span className="font-medium text-foreground">
                        {t.assignedBy?.name ?? "Admin"}
                      </span>
                      <span className="mx-1.5">·</span>
                      {format(new Date(t.createdAt), "d MMM, h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t">
                  <span className="text-xs text-muted-foreground mr-1">Set status:</span>
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = t.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => onSetStatus(t.id, opt.value, t.status)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                          isActive ? opt.active : opt.idle,
                        )}
                      >
                        <Icon className={cn("w-3 h-3", isActive && opt.value === "working" && "animate-spin")} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
