import { type ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardList,
  CalendarCheck,
  LogOut,
  FileText,
  PlusCircle,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Notifications from "@/components/Notifications";
import NotificationBell from "@/components/NotificationBell";
import { ListTodo } from "lucide-react";

import type { ModuleKey } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: ModuleKey;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Work Logs", href: "/admin/worklogs", icon: FileText },
  { label: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
  { label: "Tasks", href: "/admin/tasks", icon: ListTodo },
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Clients", href: "/admin/clients", icon: Building2 },
];

const employeeNav: NavItem[] = [
  { label: "My Dashboard", href: "/employee/dashboard", icon: LayoutDashboard },
  { label: "My Assign", href: "/employee/tasks", icon: ListTodo, module: "tasks" },
  { label: "Submit Work", href: "/employee/submit", icon: PlusCircle, module: "worklogs" },
  { label: "My Work Logs", href: "/employee/worklogs", icon: ClipboardList, module: "worklogs" },
  { label: "Tasks", href: "/employee/tasks-manage", icon: ListTodo, module: "tasks" },
  { label: "Clients", href: "/employee/clients", icon: Building2, module: "clients" },
  { label: "Employees", href: "/employee/employees", icon: Users, module: "employees" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { employee, logout, can } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  if (!employee) return <>{children}</>;

  const baseNav = employee.role === "admin" ? adminNav : employeeNav;
  const navItems = baseNav.filter((item) => !item.module || can(item.module, "view"));

  const sidebarInner = (
    <>
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">CA</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight">CA Office</p>
            <p className="text-xs text-sidebar-foreground/50 leading-tight capitalize">{employee.role}</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{employee.name}</p>
          <p className="text-xs text-sidebar-foreground/40 truncate">{employee.username}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 min-h-screen bg-sidebar text-sidebar-foreground flex-col shrink-0">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl">
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center justify-between px-3 sm:px-4 shrink-0 gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 rounded hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="md:hidden flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded bg-sidebar-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">CA</span>
            </div>
            <p className="text-sm font-semibold truncate">CA Office</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {employee.role === "admin" && <NotificationBell />}
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      <Notifications />
    </div>
  );
}
