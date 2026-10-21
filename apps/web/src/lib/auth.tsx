import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingState } from "../components/ui";
import { ApiError, errorMessage, http } from "./api-client";
import { getToken, setToken, tokenExpiry } from "./session";
import type { Role, User } from "./types";
export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string;
  notice: string;
  login: (email: string, password: string) => Promise<User>;
  logout: (message?: string) => void;
  retry: () => void;
  updateUser: (user: User, session: string | null) => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [token, updateToken] = useState(getToken);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [attempt, setAttempt] = useState(0);
  const logout = useCallback(
    (message = "") => {
      setToken(null);
      updateToken(null);
      setUser(null);
      setError("");
      setNotice(message);
      setLoading(false);
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  useEffect(() => {
    const onUnauthorized = () =>
      logout("Your session has ended. Please log in again.");
    window.addEventListener("clearhire:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("clearhire:unauthorized", onUnauthorized);
  }, [logout]);
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const expiry = tokenExpiry(token);
    if (!expiry || expiry <= Date.now()) {
      logout("Your session has ended. Please log in again.");
      return;
    }
    const timeout = window.setTimeout(
      () => logout("Your session has ended. Please log in again."),
      Math.min(expiry - Date.now(), 2147483647),
    );
    return () => window.clearTimeout(timeout);
  }, [token, logout]);
  useEffect(() => {
    const current = getToken();
    if (!current) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    http
      .get<{ user: User }>("/auth/current-user", controller.signal)
      .then((result) => {
        if (getToken() === current) {
          setUser(result.user);
          client.setQueryData(
            ["account", result.user.id, "current-user"],
            result,
          );
        }
      })
      .catch((issue: unknown) => {
        if (controller.signal.aborted || getToken() !== current) return;
        if (issue instanceof ApiError && [401, 404].includes(issue.status))
          logout("Please log in again.");
        else setError(errorMessage(issue));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, logout, client]);
  async function login(email: string, password: string) {
    const result = await http.send<{ user: User; accessToken: string }>(
      "/auth/login",
      "POST",
      { email, password },
      { public: true },
    );
    await client.cancelQueries();
    client.clear();
    setToken(result.accessToken);
    updateToken(result.accessToken);
    setUser(result.user);
    client.setQueryData(["account", result.user.id, "current-user"], {
      user: result.user,
    });
    setNotice("");
    setError("");
    setLoading(false);
    return result.user;
  }
  function updateUser(next: User, session: string | null) {
    // A late response after logout/login must never restore the old account.
    if (!session || session !== getToken() || user?.id !== next.id) return;
    setUser(next);
    client.setQueryData(["account", next.id, "current-user"], { user: next });
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        notice,
        login,
        updateUser,
        logout,
        retry: () => setAttempt((v) => v + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Missing AuthProvider");
  return value;
}
export function home(role: Role) {
  return `/${role}`;
}
export function ProtectedRoute({ role }: { role: Role }) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.loading)
    return (
      <main className="auth-state">
        <LoadingState message="Checking your session…" />
      </main>
    );
  if (auth.error)
    return (
      <main className="auth-state">
        <h1>Unable to verify your session</h1>
        <p role="alert">{auth.error}</p>
        <button onClick={auth.retry}>Retry</button>
        <button className="secondary" onClick={() => auth.logout()}>
          Log out
        </button>
      </main>
    );
  if (!auth.user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (auth.user.role !== role)
    return <Navigate to={home(auth.user.role)} replace />;
  return <Outlet />;
}
