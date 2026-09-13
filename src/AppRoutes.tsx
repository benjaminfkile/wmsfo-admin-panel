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
import MediaLibrary from "./pages/media/MediaLibrary";
import SponsorsList from "./pages/sponsors/SponsorsList";
import SponsorDetail from "./pages/sponsors/SponsorDetail";
import SponsorOrder from "./pages/sponsors/SponsorOrder";
import CookieTypesList from "./pages/cookieTypes/CookieTypesList";
import Settings from "./pages/settings/Settings";
import Subscribers from "./pages/subscribers/Subscribers";
import People from "./pages/people/People";
import ContactMessages from "./pages/contact/ContactMessages";
import PagesList from "./pages/pages/PagesList";
import PageEditor from "./pages/pages/PageEditor";
import SiteSettings from "./pages/siteSettings/SiteSettings";
import Publish from "./pages/publish/Publish";
import ApiKeysList from "./pages/apiKeys/ApiKeysList";
import AgentsPage from "./pages/agents/AgentsPage";
import AuditPage from "./pages/audit/AuditPage";
import QrCodesList from "./pages/qr/QrCodesList";
import QrCodeDetail from "./pages/qr/QrCodeDetail";
import ScanPlaceholder from "./pages/qr/ScanPlaceholder";
import { NotifyProvider } from "./hooks/useNotify";
import { ALL_ROUTES } from "./routesConfig";
import { canAccess, landingFor } from "./lib/roles";
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
  media: <MediaLibrary />,
  sponsors: <SponsorsList />,
  "sponsors-order": <SponsorOrder />,
  "cookie-types": <CookieTypesList />,
  settings: <Settings />,
  subscribers: <Subscribers />,
  people: <People />,
  "contact-messages": <ContactMessages />,
  pages: <PagesList />,
  "site-settings": <SiteSettings />,
  publish: <Publish />,
  "api-keys": <ApiKeysList />,
  agents: <AgentsPage />,
  audit: <AuditPage />,
  "qr-codes": <QrCodesList />,
  scan: <ScanPlaceholder />,
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
          {ALL_ROUTES.map((r) => {
            const element =
              r.path === "/" && !canAccess(role, r.key) ? (
                <Navigate to={landingFor(role)} replace />
              ) : (
                elementFor(role, r.key, r.label)
              );
            return (
              <Route
                key={r.path}
                index={r.path === "/"}
                path={r.path === "/" ? undefined : r.path.replace(/^\//, "")}
                element={element}
              />
            );
          })}
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
          <Route
            path="sponsors/:id"
            element={
              canAccess(role, "sponsors") ? (
                <SponsorDetail />
              ) : (
                <NotAvailable />
              )
            }
          />
          <Route
            path="pages/:id"
            element={
              canAccess(role, "pages") ? (
                <PageEditor />
              ) : (
                <NotAvailable />
              )
            }
          />
          <Route
            path="qr-codes/:id"
            element={
              canAccess(role, "qr-codes") ? (
                <QrCodeDetail />
              ) : (
                <NotAvailable />
              )
            }
          />
          <Route
            path="*"
            element={<Navigate to={landingFor(role)} replace />}
          />
        </Route>
      </Routes>
    </NotifyProvider>
  );
}
