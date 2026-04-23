import { Fragment, useRef, useState } from "react";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Upload, ChevronDown, ChevronRight } from "lucide-react";

interface ClientForm {
  name: string;
  code: string;
  category: string;
  gstin: string;
  contactNo: string;
  filingFrequency: string;
  taxAudit: boolean;
  allottedTo: string;
  loginId: string;
  gstPassword: string;
  upiId: string;
  workingType: string;
  status: string;
  callingStatus: string;
  workingStatus: string;
  r1Status: string;
  r1Date: string;
  r3bStatus: string;
  r3bDate: string;
}

const EMPTY_FORM: ClientForm = {
  name: "", code: "", category: "",
  gstin: "", contactNo: "", filingFrequency: "", taxAudit: false,
  allottedTo: "", loginId: "", gstPassword: "", upiId: "",
  workingType: "", status: "",
  callingStatus: "", workingStatus: "",
  r1Status: "", r1Date: "", r3bStatus: "", r3bDate: "",
};

type ImportRow = {
  name: string;
  code?: string;
  category?: string;
  gstin?: string;
  contactNo?: string;
  filingFrequency?: string;
  taxAudit?: boolean;
  allottedTo?: string;
  loginId?: string;
  gstPassword?: string;
  upiId?: string;
  workingType?: string;
  status?: string;
  callingStatus?: string;
  workingStatus?: string;
  r1Status?: string;
  r1Date?: string;
  r3bStatus?: string;
  r3bDate?: string;
};

function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      row.push(cur); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }
  return rows;
}

function parseCsv(text: string): ImportRow[] {
  const all = splitCsvLines(text);
  if (all.length === 0) return [];

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headerMap: Record<string, keyof ImportRow> = {
    name: "name", clientname: "name", legalnameofbusiness: "name", legalname: "name", client: "name", businessname: "name",
    code: "code",
    category: "category", type: "category",
    gstin: "gstin", gstno: "gstin", gst: "gstin",
    contactno: "contactNo", contact: "contactNo", phone: "contactNo", mobile: "contactNo", phoneno: "contactNo", mobileno: "contactNo",
    filingrepetition: "filingFrequency", filingfrequency: "filingFrequency", frequency: "filingFrequency",
    taxaudit: "taxAudit",
    clientallotted: "allottedTo", allotted: "allottedTo", allottedto: "allottedTo",
    loginid: "loginId", gstloginid: "loginId", login: "loginId",
    password: "gstPassword", gstpassword: "gstPassword",
    upiid: "upiId", upi: "upiId",
    workingtype: "workingType",
    status: "status",
    callingstatus: "callingStatus",
    workingallotted: "workingStatus", workingstatus: "workingStatus",
    "2bstatus": "r1Status",
    r1filingstatus: "r1Status", r1status: "r1Status",
    date: "r1Date",
    "3bfilingstatus": "r3bStatus", r3bfilingstatus: "r3bStatus", r3bstatus: "r3bStatus",
    date2: "r3bDate",
  };

  const headerCells = all[0].map((h) => norm(h));
  const fieldByCol: Array<keyof ImportRow | null> = headerCells.map((h) => headerMap[h] ?? null);
  const hasHeader = fieldByCol.some((f) => f === "name");
  const startIdx = hasHeader ? 1 : 0;

  const out: ImportRow[] = [];
  for (let i = startIdx; i < all.length; i++) {
    const cols = all[i];
    if (!hasHeader) {
      const name = (cols[0] ?? "").trim();
      if (!name) continue;
      out.push({ name, code: cols[1]?.trim() || undefined, category: cols[2]?.trim() || undefined });
      continue;
    }
    const obj: Partial<Record<keyof ImportRow, string | boolean>> = {};
    for (let j = 0; j < fieldByCol.length; j++) {
      const field = fieldByCol[j];
      if (!field) continue;
      const raw = (cols[j] ?? "").trim();
      if (!raw) continue;
      if (field === "taxAudit") {
        obj.taxAudit = /^(taxaudit|yes|y|true|1)$/i.test(raw);
      } else {
        obj[field] = raw;
      }
    }
    const name = (obj.name as string | undefined)?.trim();
    if (!name) continue;
    out.push(obj as ImportRow);
  }
  return out;
}

export default function AdminClients() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editClient, setEditClient] = useState<{ id: number } | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: clients = [], isLoading } = useListClients({
    query: { queryKey: getListClientsQueryKey() },
  });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
      (c.category && c.category.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => {
    setEditClient(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (c: typeof clients[0]) => {
    const ext = c as typeof c & Partial<ClientForm>;
    setEditClient({ id: c.id });
    setForm({
      name: c.name,
      code: c.code ?? "",
      category: c.category ?? "",
      gstin: ext.gstin ?? "",
      contactNo: ext.contactNo ?? "",
      filingFrequency: ext.filingFrequency ?? c.category ?? "",
      taxAudit: !!ext.taxAudit,
      allottedTo: ext.allottedTo ?? "",
      loginId: ext.loginId ?? "",
      gstPassword: ext.gstPassword ?? "",
      upiId: ext.upiId ?? "",
      workingType: ext.workingType ?? "",
      status: ext.status ?? "",
      callingStatus: ext.callingStatus ?? "",
      workingStatus: ext.workingStatus ?? "",
      r1Status: ext.r1Status ?? "",
      r1Date: ext.r1Date ?? "",
      r3bStatus: ext.r3bStatus ?? "",
      r3bDate: ext.r3bDate ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        code: form.code || form.gstin || undefined,
        category: form.category || form.filingFrequency || undefined,
        gstin: form.gstin || undefined,
        contactNo: form.contactNo || undefined,
        filingFrequency: form.filingFrequency || undefined,
        taxAudit: form.taxAudit,
        allottedTo: form.allottedTo || undefined,
        loginId: form.loginId || undefined,
        gstPassword: form.gstPassword || undefined,
        upiId: form.upiId || undefined,
        workingType: form.workingType || undefined,
        status: form.status || undefined,
        callingStatus: form.callingStatus || undefined,
        workingStatus: form.workingStatus || undefined,
        r1Status: form.r1Status || undefined,
        r1Date: form.r1Date || undefined,
        r3bStatus: form.r3bStatus || undefined,
        r3bDate: form.r3bDate || undefined,
      };
      if (editClient) {
        await updateClient.mutateAsync({ id: editClient.id, data: payload as never });
      } else {
        await createClient.mutateAsync({ data: payload as never });
      }
      await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await updateClient.mutateAsync({ id, data: { isActive: !isActive } });
    await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this client?")) return;
    await deleteClient.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected client${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        try { await deleteClient.mutateAsync({ id }); } catch (e) { console.error("Delete failed for", id, e); }
      }
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setImportMsg("No valid rows found in the CSV.");
        return;
      }
      const res = awaitfetch("https://ca-backend-8w90.onrender.com/api/clients/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: rows }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setImportMsg(`Import failed: ${j.error ?? res.statusText}`);
        return;
      }
      const j = await res.json();
      setImportMsg(`Imported ${j.imported} client(s).`);
      await queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
    } catch (err) {
      setImportMsg(`Import error: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const categories = [...new Set(clients.map((c) => c.category).filter(Boolean))];
  const canAdd = can("clients", "add");
  const canEdit = can("clients", "edit");
  const canDelete = can("clients", "delete");

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clients registered</p>
        </div>
        <div className="flex items-center gap-2">
          {canAdd && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                {importing ? "Importing..." : "Import CSV"}
              </Button>
              <Button onClick={openCreate} size="sm" className="h-9">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Client
              </Button>
            </>
          )}
        </div>
      </div>

      {importMsg && (
        <div className="text-xs px-3 py-2 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
          {importMsg}{" "}
          <span className="text-blue-600">
            (Expected CSV columns: <code>name</code>, <code>code</code>, <code>category</code>)
          </span>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or category..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{filteredClients.length} clients</div>
            {canDelete && selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {bulkDeleting ? "Deleting..." : `Delete Selected (${selected.size})`}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {canDelete && (
                      <th className="w-8 px-2 py-2.5">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          className="cursor-pointer"
                          checked={filteredClients.length > 0 && filteredClients.every((c) => selected.has(c.id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelected(new Set(filteredClients.map((c) => c.id)));
                            else setSelected(new Set());
                          }}
                        />
                      </th>
                    )}
                    <th className="w-8 px-2 py-2.5"></th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">GSTIN</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Contact</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Frequency</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Allotted</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClients.map((client) => {
                    const c = client as typeof client & {
                      gstin?: string | null; contactNo?: string | null; filingFrequency?: string | null;
                      allottedTo?: string | null; taxAudit?: boolean;
                      loginId?: string | null; gstPassword?: string | null; upiId?: string | null;
                      workingType?: string | null; status?: string | null;
                      callingStatus?: string | null; workingStatus?: string | null;
                      r1Status?: string | null; r1Date?: string | null;
                      r3bStatus?: string | null; r3bDate?: string | null;
                    };
                    const isOpen = expanded.has(client.id);
                    return (
                    <Fragment key={client.id}>
                    <tr className={`hover:bg-muted/30 transition-colors ${selected.has(client.id) ? "bg-muted/40" : ""}`}>
                      {canDelete && (
                        <td className="px-2 py-2.5 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${client.name}`}
                            className="cursor-pointer"
                            checked={selected.has(client.id)}
                            onChange={() => toggleSelect(client.id)}
                          />
                        </td>
                      )}
                      <td className="px-2 py-2.5 align-top">
                        <button
                          onClick={() => toggleExpand(client.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{client.name}</span>
                          {c.taxAudit && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">TAX AUDIT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.gstin || client.code || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.contactNo || "—"}</td>
                      <td className="px-4 py-2.5">
                        {c.filingFrequency || client.category ? (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{c.filingFrequency || client.category}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">{c.allottedTo || "—"}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => canEdit && toggleActive(client.id, client.isActive)} disabled={!canEdit}>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${client.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {client.isActive ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {canEdit && (
                            <button onClick={() => openEdit(client)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(client.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        {canDelete && <td></td>}
                        <td></td>
                        <td colSpan={7} className="px-4 py-3">
                          <ClientDetails
                            client={{
                              code: client.code ?? null,
                              category: client.category ?? null,
                              gstin: c.gstin ?? null,
                              contactNo: c.contactNo ?? null,
                              filingFrequency: c.filingFrequency ?? null,
                              taxAudit: !!c.taxAudit,
                              allottedTo: c.allottedTo ?? null,
                              loginId: c.loginId ?? null,
                              gstPassword: c.gstPassword ?? null,
                              upiId: c.upiId ?? null,
                              workingType: c.workingType ?? null,
                              status: c.status ?? null,
                              callingStatus: c.callingStatus ?? null,
                              workingStatus: c.workingStatus ?? null,
                              r1Status: c.r1Status ?? null,
                              r1Date: c.r1Date ?? null,
                              r3bStatus: c.r3bStatus ?? null,
                              r3bDate: c.r3bDate ?? null,
                            }}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Legal Name of Business *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. ABC PVT LTD"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GSTIN</Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    placeholder="27ABCCA8766F1ZF"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact No</Label>
                  <Input
                    value={form.contactNo}
                    onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
                    placeholder="9876543210"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Filing Frequency</Label>
                  <Input
                    value={form.filingFrequency}
                    onChange={(e) => setForm({ ...form, filingFrequency: e.target.value })}
                    placeholder="Monthly / Quarterly"
                    className="h-9 text-sm"
                    list="freq-list"
                  />
                  <datalist id="freq-list">
                    <option value="Monthly" />
                    <option value="Quarterly" />
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Allotted To</Label>
                  <Input
                    value={form.allottedTo}
                    onChange={(e) => setForm({ ...form, allottedTo: e.target.value })}
                    placeholder="e.g. rahul"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="taxAudit"
                    checked={form.taxAudit}
                    onChange={(e) => setForm({ ...form, taxAudit: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                  <Label htmlFor="taxAudit" className="text-xs cursor-pointer">Tax Audit Client</Label>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">GST Portal Login</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Login ID</Label>
                  <Input
                    value={form.loginId}
                    onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                    placeholder="GST portal username"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    value={form.gstPassword}
                    onChange={(e) => setForm({ ...form, gstPassword: e.target.value })}
                    placeholder="GST portal password"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">UPI ID</Label>
                  <Input
                    value={form.upiId}
                    onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                    placeholder="e.g. 9876543210@ybl"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Filing Status</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">R1 Filing Status</Label>
                  <Input
                    value={form.r1Status}
                    onChange={(e) => setForm({ ...form, r1Status: e.target.value })}
                    placeholder="Filed / hold / pending"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">R1 Date</Label>
                  <Input
                    value={form.r1Date}
                    onChange={(e) => setForm({ ...form, r1Date: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">3B Filing Status</Label>
                  <Input
                    value={form.r3bStatus}
                    onChange={(e) => setForm({ ...form, r3bStatus: e.target.value })}
                    placeholder="Filed / hold / pending"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">3B Date</Label>
                  <Input
                    value={form.r3bDate}
                    onChange={(e) => setForm({ ...form, r3bDate: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Working Type</Label>
                  <Input
                    value={form.workingType}
                    onChange={(e) => setForm({ ...form, workingType: e.target.value })}
                    placeholder="B2B / B2Cs / B2B & B2Cs"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Input
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    placeholder="Refund / Payment / Rcm"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Calling Status</Label>
                  <Input
                    value={form.callingStatus}
                    onChange={(e) => setForm({ ...form, callingStatus: e.target.value })}
                    placeholder="data received on mail (DD/MM/YY)"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Working Status</Label>
                  <Input
                    value={form.workingStatus}
                    onChange={(e) => setForm({ ...form, workingStatus: e.target.value })}
                    placeholder="working / nil / hold"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <details className="border rounded-md p-2">
              <summary className="text-xs font-medium cursor-pointer text-muted-foreground">Internal fields (Code & Category)</summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Internal Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Auto-filled from GSTIN"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Internal Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Proprietorship, Partnership"
                    className="h-9 text-sm font-normal"
                    list="category-list"
                  />
                  <datalist id="category-list">
                    {categories.map((cat) => (
                      <option key={cat as string} value={cat as string} />
                    ))}
                  </datalist>
                </div>
              </div>
            </details>

            <div className="flex gap-2 pt-2 sticky bottom-0 bg-background">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 h-9 text-sm" onClick={handleSave} disabled={saving || !form.name}>
                {saving ? "Saving..." : editClient ? "Update Client" : "Create Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientDetails({
  client,
}: {
  client: {
    code: string | null;
    category: string | null;
    gstin: string | null;
    contactNo: string | null;
    filingFrequency: string | null;
    taxAudit: boolean;
    allottedTo: string | null;
    loginId: string | null;
    gstPassword: string | null;
    upiId: string | null;
    workingType: string | null;
    status: string | null;
    callingStatus: string | null;
    workingStatus: string | null;
    r1Status: string | null;
    r1Date: string | null;
    r3bStatus: string | null;
    r3bDate: string | null;
  };
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );

  const Field = ({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) => (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs text-foreground truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-3 bg-card border rounded-md p-3">
      <Section title="Basic Info">
        <Field label="GSTIN" value={client.gstin} mono />
        <Field label="Contact No" value={client.contactNo} />
        <Field label="Filing Frequency" value={client.filingFrequency} />
        <Field label="Allotted To" value={client.allottedTo} />
        <Field label="Tax Audit" value={client.taxAudit ? "Yes" : "No"} />
      </Section>
      <Section title="GST Portal Login">
        <Field label="Login ID" value={client.loginId} />
        <Field label="Password" value={client.gstPassword} mono />
        <Field label="UPI ID" value={client.upiId} />
      </Section>
      <Section title="Filing Status">
        <Field label="R1 Filing Status" value={client.r1Status} />
        <Field label="R1 Date" value={client.r1Date} />
        <Field label="3B Filing Status" value={client.r3bStatus} />
        <Field label="3B Date" value={client.r3bDate} />
        <Field label="Working Type" value={client.workingType} />
        <Field label="Status" value={client.status} />
        <Field label="Calling Status" value={client.callingStatus} />
        <Field label="Working Status" value={client.workingStatus} />
      </Section>
      <Section title="Internal">
        <Field label="Code" value={client.code} mono />
        <Field label="Category" value={client.category} />
      </Section>
    </div>
  );
}
