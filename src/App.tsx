import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import EmployeeDashboard from "@/pages/employee/Dashboard";
import EmployeeWorkLogs from "@/pages/employee/WorkLogs";
import EmployeeTasks from "@/pages/employee/Tasks";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminWorkLogs from "@/pages/admin/WorkLogs";
import AdminAttendance from "@/pages/admin/Attendance";
import AdminEmployees from "@/pages/admin/Employees";
import AdminClients from "@/pages/admin/Clients";
import AdminTasks from "@/pages/admin/Tasks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({
  component: Component,
  allowedRole,
  requireModule,
}: {
  component: React.ComponentType;
  allowedRole?: "admin" | "employee";
  requireModule?: import("@/contexts/AuthContext").ModuleKey;
}) {
  const { employee, can } = useAuth();
  if (!employee) return <Redirect to="/" />;
  if (allowedRole && employee.role !== allowedRole) {
    return <Redirect to={employee.role === "admin" ? "/admin/dashboard" : "/employee/dashboard"} />;
  }
  if (requireModule && !can(requireModule, "view")) {
    return <Redirect to={employee.role === "admin" ? "/admin/dashboard" : "/employee/dashboard"} />;
  }
  return <Component />;
}

function Router() {
  const { employee } = useAuth();

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/employee/dashboard">
          <ProtectedRoute component={EmployeeDashboard} allowedRole="employee" />
        </Route>
        <Route path="/employee/worklogs">
          <ProtectedRoute component={EmployeeWorkLogs} allowedRole="employee" />
        </Route>
        <Route path="/employee/tasks">
          <ProtectedRoute component={EmployeeTasks} allowedRole="employee" />
        </Route>
        <Route path="/employee/submit">
          <ProtectedRoute component={EmployeeDashboard} allowedRole="employee" />
        </Route>
        <Route path="/employee/clients">
          <ProtectedRoute component={AdminClients} allowedRole="employee" requireModule="clients" />
        </Route>
        <Route path="/employee/employees">
          <ProtectedRoute component={AdminEmployees} allowedRole="employee" requireModule="employees" />
        </Route>
        <Route path="/employee/tasks-manage">
          <ProtectedRoute component={AdminTasks} allowedRole="employee" requireModule="tasks" />
        </Route>
        <Route path="/admin/dashboard">
          <ProtectedRoute component={AdminDashboard} allowedRole="admin" />
        </Route>
        <Route path="/admin/worklogs">
          <ProtectedRoute component={AdminWorkLogs} allowedRole="admin" />
        </Route>
        <Route path="/admin/attendance">
          <ProtectedRoute component={AdminAttendance} allowedRole="admin" />
        </Route>
        <Route path="/admin/tasks">
          <ProtectedRoute component={AdminTasks} allowedRole="admin" />
        </Route>
        <Route path="/admin/employees">
          <ProtectedRoute component={AdminEmployees} allowedRole="admin" />
        </Route>
        <Route path="/admin/clients">
          <ProtectedRoute component={AdminClients} allowedRole="admin" />
        </Route>
        <Route>
          {employee
            ? employee.role === "admin"
              ? <Redirect to="/admin/dashboard" />
              : <Redirect to="/employee/dashboard" />
            : <Redirect to="/" />
          }
        </Route>
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
