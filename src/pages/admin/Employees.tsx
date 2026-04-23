import { useEffect, useState } from "react";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Shield, User, KeyRound, Lock } from "lucide-react";
import { EMPTY_PERMS, type ModuleKey, type ActionKey, type Permissions } from "@/contexts/AuthContext";

interface EmployeeForm {
  name: string;
  username: string;
  password: string;
  role: "admin" | "employee";
}

const MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: "clients", label: "Clients" },
  { key: "tasks", label: "Tasks" },
  { key: "worklogs", label: "Work Logs" },
  { key: "attendance", label: "Attendance" },
  { key: "employees", label: "Employees" },
];

const ACTIONS: ActionKey[] = ["view", "add", "edit", "delete"];

export default function AdminEmployees() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editEmployee, setEditEmployee] = useState<{ id: number; name: string; username: string; role: string; isActive: boolean } | null>(null);
  const [form, setForm] = useState<EmployeeForm>({ name: "", username: "", password: "", role: "employee" });
  const [saving, setSaving] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<{ id: number; name: string } | null>(null);
  const [accessPerms, setAccessPerms] = useState<Permissions>(EMPTY_PERMS);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<{ id: number; name: string } | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const openCreate = () => {
    setEditEmployee(null);
    setForm({ name: "", username: "", password: "", role: "employee" });
    setShowDialog(true);
  };

  const openEdit = (emp: typeof employees[0]) => {
    setEditEmployee({ id: emp.id, name: emp.name, username: emp.username, role: emp.role, isActive: emp.isActive });
    setForm({ name: emp.name, username: emp.username, password: "", role: emp.role as "admin" | "employee" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.username) return;
    setSaving(true);
    try {
      if (editEmployee) {
        const data: Record<string, unknown> = { name: form.name, username: form.username, role: form.role };
        if (form.password) data.password = form.password;
        await updateEmployee.mutateAsync({ id: editEmployee.id, data });
      } else {
        if (!form.password) return;
        await createEmployee.mutateAsync({ data: { name: form.name, username: form.username, password: form.password, role: form.role } });
      }
      await queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await updateEmployee.mutateAsync({ id, data: { isActive: !isActive } });
    await queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this employee?")) return;
    await deleteEmployee.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
  };

  const openAccess = (emp: typeof employees[0]) => {
    setAccessTarget({ id: emp.id, name: emp.name });
    const fromServer = (emp as unknown as { permissions?: Permissions }).permissions;
    const merged: Permissions = { ...EMPTY_PERMS };
    for (const m of MODULES) {
      const src = fromServer?.[m.key] ?? {};
      merged[m.key] = {
        view: !!src.view,
        add: !!src.add,
        edit: !!src.edit,
        delete: !!src.delete,
      };
    }
    setAccessPerms(merged);
    setAccessError(null);
    setAccessOpen(true);
  };

  const togglePerm = (mod: ModuleKey, action: ActionKey) => {
    setAccessPerms((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod][action] },
    }));
  };

  const toggleRow = (mod: ModuleKey) => {
    const allOn = ACTIONS.every((a) => accessPerms[mod][a]);
    setAccessPerms((prev) => ({
      ...prev,
      [mod]: { view: !allOn, add: !allOn, edit: !allOn, delete: !allOn },
    }));
  };

  const saveAccess = async () => {
    if (!accessTarget) return;
    setAccessSaving(true);
    setAccessError(null);
    try {
      const res = await fetch(`/api/employees/${accessTarget.id}/permissions`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: accessPerms }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setAccessError(j.error ?? `Failed (${res.status})`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setAccessOpen(false);
    } finally {
      setAccessSaving(false);
    }
  };

  useEffect(() => {
    if (!accessOpen) setAccessError(null);
  }, [accessOpen]);

  const openPwd = (emp: typeof employees[0]) => {
    setPwdTarget({ id: emp.id, name: emp.name });
    setPwdValue("");
    setPwdConfirm("");
    setPwdError(null);
    setPwdMsg(null);
    setPwdOpen(true);
  };

  const savePwd = async () => {
    if (!pwdTarget) return;
    if (pwdValue.length < 4) {
      setPwdError("Password must be at least 4 characters.");
      return;
    }
    if (pwdValue !== pwdConfirm) {
      setPwdError("Passwords do not match.");
      return;
    }
    setPwdSaving(true);
    setPwdError(null);
    try {
      await updateEmployee.mutateAsync({ id: pwdTarget.id, data: { password: pwdValue } });
      await queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      setPwdMsg(`Password reset for ${pwdTarget.name}.`);
      setTimeout(() => setPwdOpen(false), 800);
    } catch (e) {
      setPwdError((e as Error).message ?? "Failed to reset password.");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage team members and their access</p>
        </div>
        <Button onClick={openCreate} size="sm" className="h-9">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Employee
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Username</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{emp.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${emp.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}`}>
                        {emp.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(emp.id, emp.isActive)}>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {emp.role !== "admin" && (
                          <button
                            onClick={() => openAccess(emp)}
                            className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:border-primary"
                            title="Edit Access"
                          >
                            <KeyRound className="w-3 h-3" />
                            Edit Access
                          </button>
                        )}
                        <button
                          onClick={() => openPwd(emp)}
                          className="text-muted-foreground hover:text-amber-600 transition-colors inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:border-amber-600"
                          title="Reset Password"
                        >
                          <Lock className="w-3 h-3" />
                          Reset
                        </button>
                        <button onClick={() => openEdit(emp)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(emp.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Employee name"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Login username"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{editEmployee ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editEmployee ? "Leave blank to keep current" : "Password"}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "employee" })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 h-9 text-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              Reset Password — {pwdTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              Set a new password for this employee. They will need to log in again with the new password.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                value={pwdValue}
                onChange={(e) => setPwdValue(e.target.value)}
                placeholder="Enter new password"
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Confirm Password</Label>
              <Input
                type="password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="h-9 text-sm"
              />
            </div>
            {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
            {pwdMsg && <p className="text-xs text-green-700">{pwdMsg}</p>}
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setPwdOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 h-9 text-sm" onClick={savePwd} disabled={pwdSaving || !pwdValue}>
                {pwdSaving ? "Saving..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Edit Access — {accessTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              Choose which actions this employee can perform per module. Admins always have full access.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="text-center px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {MODULES.map((m) => (
                    <tr key={m.key} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-medium hover:text-primary text-sm"
                          onClick={() => toggleRow(m.key)}
                          title="Toggle all"
                        >
                          {m.label}
                        </button>
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="text-center px-2 py-2">
                          <input
                            type="checkbox"
                            checked={accessPerms[m.key][a]}
                            onChange={() => togglePerm(m.key, a)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accessError && <p className="text-xs text-destructive">{accessError}</p>}
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setAccessOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 h-9 text-sm" onClick={saveAccess} disabled={accessSaving}>
                {accessSaving ? "Saving..." : "Save Access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
