import { Navigate, Route, Routes } from "react-router-dom";
import RequireAdmin from "./auth/RequireAdmin";
import MainLayout from "./components/layout/MainLayout";
import Callback from "./pages/auth/Callback";
import Placeholder from "./pages/Placeholder";
import NotAvailable from "./pages/NotAvailable";
import { ALL_ROUTES } from "./routesConfig";
import { canAccess } from "./lib/roles";
import { useAuth } from "./auth/AuthProvider";
import type { AppThemeMode } from "./theme/theme";

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

function AuthedShell({ themeMode, onToggleTheme }: Props) {
  const { state } = useAuth();
  if (state.kind !== "member") return null;
  const { role, email } = state;
  return (
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
            element={
              canAccess(role, r.key) ? (
                <Placeholder title={r.label} />
              ) : (
                <NotAvailable />
              )
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
