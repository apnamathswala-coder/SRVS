import { useState, useMemo, type ReactNode } from "react";
import {
  useCreateTask,
  useListEmployees,
  useListClients,
  getListTasksQueryKey,
  getListEmployeesQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, ListPlus, Search } from "lucide-react";

interface Props {
  trigger?: ReactNode;
}

const WORK_TYPES = ["Purchase", "Sale", "BankStatement", "GSTR1", "GSTR2B", "GSTR3B", "Other"] as const;
const WORK_TYPE_LABELS: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  BankStatement: "Bank Statement",
  GSTR1: "GSTR-1",
  GSTR2B: "GSTR-2B",
  GSTR3B: "GSTR-3B",
  Other: "Other",
};

export default function AssignTaskDialog({ trigger }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [workType, setWorkType] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const empKey = getListEmployeesQueryKey();
  const clientsKey = getListClientsQueryKey();
  const { data: employees = [] } = useListEmployees({ query: { queryKey: empKey } });
  const { data: clients = [] } = useListClients({ query: { queryKey: clientsKey } });
  const employeeOptions = employees.filter((e) => e.role === "employee" && e.isActive);

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) => c.isActive && c.name.toLowerCase().includes(clientSearch.toLowerCase()),
      ),
    [clients, clientSearch],
  );

  const createTask = useCreateTask();

  const reset = () => {
    setTitle("");
    setDescription("");
    setAssignedToId("");
    setClientSearch("");
    setSelectedClientId("");
    setWorkType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !assignedToId) return;
    setSubmitting(true);
    try {
      await createTask.mutateAsync({
        data: {
          title,
          description: description || undefined,
          assignedToId: parseInt(assignedToId, 10),
          clientId: selectedClientId ? parseInt(selectedClientId, 10) : undefined,
          workType: workType || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      const emp = employeeOptions.find((e) => String(e.id) === assignedToId);
      toast({
        title: "Task assigned",
        description: emp ? `${emp.name} will be notified.` : "Employee will be notified.",
      });
      reset();
      setOpen(false);
    } catch {
      toast({ title: "Failed to assign task", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <ListPlus className="w-4 h-4 mr-1" /> Assign Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
          <DialogDescription>
            The employee will get a popup notification immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Employee</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name} ({e.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Client (optional)</Label>
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
              <button
                type="button"
                onClick={() => { setSelectedClientId(""); setClientSearch(""); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear client
              </button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Work Type (optional)</Label>
            <Select value={workType} onValueChange={setWorkType}>
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
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. File GSTR-1 for ABC Ltd"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, deadline, instructions…"
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title || !assignedToId || submitting}>
              <Send className="w-4 h-4 mr-1" />
              {submitting ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
