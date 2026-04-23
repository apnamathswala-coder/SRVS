import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useGetMe, useLogin, useLogout } from "@workspace/api-client-react";

export type ModuleKey = "clients" | "tasks" | "worklogs" | "attendance" | "employees";
export type ActionKey = "view" | "add" | "edit" | "delete";
export type Permissions = Record<ModuleKey, Record<ActionKey, boolean>>;

const FULL_PERMS: Permissions = {
  clients: { view: true, add: true, edit: true, delete: true },
  tasks: { view: true, add: true, edit: true, delete: true },
  worklogs: { view: true, add: true, edit: true, delete: true },
  attendance: { view: true, add: true, edit: true, delete: true },
  employees: { view: true, add: true, edit: true, delete: true },
};

const EMPTY_PERMS: Permissions = {
  clients: { view: false, add: false, edit: false, delete: false },
  tasks: { view: false, add: false, edit: false, delete: false },
  worklogs: { view: false, add: false, edit: false, delete: false },
  attendance: { view: false, add: false, edit: false, delete: false },
  employees: { view: false, add: false, edit: false, delete: false },
};

interface Employee {
  id: number;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  permissions?: Permissions;
}

interface AuthContextType {
  employee: Employee | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (module: ModuleKey, action: ActionKey) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: meData, isLoading: meLoading } = useGetMe({
    query: {
      retry: false,
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (!meLoading) {
      if (meData) {
        setEmployee(meData as Employee);
      } else {
        setEmployee(null);
      }
      setInitialized(true);
    }
  }, [meData, meLoading]);

  const login = async (username: string, password: string) => {
    const result = await loginMutation.mutateAsync({ data: { username, password } });
    setEmployee(result.employee as Employee);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    setEmployee(null);
  };

  const can = (module: ModuleKey, action: ActionKey): boolean => {
    if (!employee) return false;
    if (employee.role === "admin") return true;
    const perms: Permissions = (employee.permissions ?? EMPTY_PERMS) as Permissions;
    return !!perms?.[module]?.[action];
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ employee, isLoading: meLoading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { FULL_PERMS, EMPTY_PERMS };
