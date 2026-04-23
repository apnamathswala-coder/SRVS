import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListWorklogs,
  useCreateWorklog,
  useListClients,
  useDeleteWorklog,
  getListWorklogsQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Plus, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import PunchCard from "@/components/PunchCard";

const WORK_TYPES = ["Purchase", "Sale", "BankStatement", "GSTR1", "GSTR2B", "GSTR3B", "Other"];

const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

export default function EmployeeDashboard() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedWorkType, setSelectedWorkType] = useState<string>("");
  const [status, setStatus] = useState<"done" | "pending">("pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const params = { date: today };
  const { data: worklogs = [], isLoading } = useListWorklogs(params, {
    query: { queryKey: getListWorklogsQueryKey(params) },
  });

  const { data: clients = [] } = useListClients({
    query: { queryKey: getListClientsQueryKey() },
  });

  const createWorklog = useCreateWorklog();
  const deleteWorklog = useDeleteWorklog();

  const filteredClients = clients.filter((c) =>
    c.isActive && c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedWorkType) return;
    setSubmitting(true);
    try {
      await createWorklog.mutateAsync({
        data: {
          clientId: parseInt(selectedClientId, 10),
          workType: selectedWorkType as "Purchase" | "Sale" | "BankStatement" | "GSTR1" | "GSTR2B" | "GSTR3B" | "Other",
          status,
          notes: notes || undefined,
          date: today,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListWorklogsQueryKey(params) });
      setSelectedClientId("");
      setSelectedWorkType("");
      setNotes("");
      setStatus("pending");
      setClientSearch("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteWorklog.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListWorklogsQueryKey(params) });
  };

  const doneCount = worklogs.filter((w) => w.status === "done").length;
  const pendingCount = worklogs.filter((w) => w.status === "pending").length;

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Good {getGreeting()}, {employee?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </div>

      <PunchCard />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Today</p>
            <p className="text-3xl font-bold text-foreground">{worklogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-600">{doneCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Pending</p>
            <p className="text-3xl font-bold text-amber-500">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Submit form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Add Work Entry</CardTitle>
              <button onClick={() => setShowForm(!showForm)} className="text-muted-foreground hover:text-foreground">
                <Plus className={cn("w-4 h-4 transition-transform", showForm && "rotate-45")} />
              </button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setSelectedClientId("");
                      }}
                      placeholder="Search client..."
                      className="pl-8 text-sm h-9"
                    />
                  </div>
                  {clientSearch && !selectedClientId && filteredClients.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto shadow-sm bg-popover">
                      {filteredClients.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientId(String(c.id));
                            setClientSearch(c.name);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          {c.name}
                          {c.code && <span className="text-muted-foreground text-xs ml-1">({c.code})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedClientId && (
                    <p className="text-xs text-green-600 font-medium">Client selected</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Work Type</Label>
                  <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPES.map((wt) => (
                        <SelectItem key={wt} value={wt}>{WORK_TYPE_LABELS[wt]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus("done")}
                      className={cn(
                        "flex-1 h-9 text-sm rounded-md border font-medium transition-colors",
                        status === "done"
                          ? "bg-green-600 text-white border-green-600"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("pending")}
                      className={cn(
                        "flex-1 h-9 text-sm rounded-md border font-medium transition-colors",
                        status === "pending"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Pending
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes..."
                    className="text-sm resize-none"
                    rows={2}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 text-sm"
                  disabled={!selectedClientId || !selectedWorkType || submitting}
                >
                  {submitting ? "Submitting..." : "Submit Entry"}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Today's entries */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Today's Entries</h2>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : worklogs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No entries yet. Add your first work entry for today.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {worklogs.map((wl) => (
                <Card key={wl.id} className="shadow-none">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{wl.client.name}</p>
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0"
                          >
                            {WORK_TYPE_LABELS[wl.workType] || wl.workType}
                          </Badge>
                          <StatusBadge status={wl.status} />
                        </div>
                        {wl.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wl.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(wl.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
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
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      Pending
    </span>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
