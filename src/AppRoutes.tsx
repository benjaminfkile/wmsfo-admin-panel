import { Navigate, Route, Routes } from "react-router-dom";
import RequireAdmin from "./auth/RequireAdmin";
import MainLayout from "./components/layout/MainLayout";
import Callback from "./pages/auth/Callback";
import Placeholder from "./pages/Placeholder";
import NotAvailable from "./pages/NotAvailable";
import Dashboard from "./pages/Dashboard";
import EventsList from "./pages/events/EventsList";
import EventDetail from "./pages/events/EventDetail";
import RoutesList from "./pages/routes/RoutesList";
import BeaconsList from "./pages/beacons/BeaconsList";
import BeaconDetail from "./pages/beacons/BeaconDetail";
import { NotifyProvider } from "./hooks/useNotify";
import { ALL_ROUTES } from "./routesConfig";
import { canAccess } from "./lib/roles";
import { useAuth } from "./auth/AuthProvider";
import type { AppThemeMode } from "./theme/theme";
import type { NavKey } from "./lib/roles";
import type { Role } from "./auth/claims";
import type { ReactElement } from "react";

interface Props {
  themeMode: AppThemeMode;
  onToggleTheme: () => void;
}

export default function AppRoutes({ themeMode, onToggleTheme }: Props) {
  return (
    <Routes>
      <Route path="/auth/callback" element={<Callback />} />
      <Route
        path="/*"
        element={
          <RequireAdmin>
            <AuthedShell themeMode={themeMode} onToggleTheme={onToggleTheme} />
          </RequireAdmin>
        }
      />
    </Routes>
  );
}

const CUSTOM_ELEMENTS: Partial<Record<NavKey, ReactElement>> = {
  dashboard: <Dashboard />,
  events: <EventsList />,
  routes: <RoutesList />,
  beacons: <BeaconsList />,
};

function elementFor(role: Role, key: NavKey, label: string): ReactElement {
  if (!canAccess(role, key)) return <NotAvailable />;
  return CUSTOM_ELEMENTS[key] ?? <Placeholder title={label} />;
}

function AuthedShell({ themeMode, onToggleTheme }: Props) {
  const { state } = useAuth();
  if (state.kind !== "member") return null;
  const { role, email } = state;
  return (
    <NotifyProvider>
      <Routes>
        <Route
          element={
            <MainLayout
              role={role}
              email={email}
              themeMode={themeMode}
              onToggleTheme={onToggleTheme}
            />
          }
        >
          {ALL_ROUTES.map((r) => (
            <Route
              key={r.path}
              index={r.path === "/"}
              path={r.path === "/" ? undefined : r.path.replace(/^\//, "")}
              element={elementFor(role, r.key, r.label)}
            />
          ))}
          <Route
            path="events/:id"
            element={
              canAccess(role, "events") ? (
                <EventDetail />
              ) : (
                <NotAvailable />
              )
            }
          />
          <Route
            path="beacons/:id"
            element={
              canAccess(role, "beacons") ? (
                <BeaconDetail />
              ) : (
                <NotAvailable />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </NotifyProvider>
  );
}
