import { useMemo, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import EnvBadge from "../EnvBadge";
import NetworkBanner from "../NetworkBanner";
import { useAuth } from "../../auth/AuthProvider";
import { signOut } from "../../auth/signOut";
import { useConfig } from "../../ConfigContext";
import { navFor, type NavKey } from "../../lib/roles";
import type { Role } from "../../auth/claims";

const drawerWidth = 220;

type NavEntry = { key: NavKey; label: string; to: string };

const ALL_ENTRIES: Record<NavKey, NavEntry> = {
  dashboard: { key: "dashboard", label: "Dashboard", to: "/" },
  events: { key: "events", label: "Events", to: "/events" },
  routes: { key: "routes", label: "Flight recordings", to: "/routes" },
  beacons: { key: "beacons", label: "Beacons", to: "/beacons" },
  pages: { key: "pages", label: "Pages", to: "/pages" },
  media: { key: "media", label: "Media", to: "/media" },
  "site-settings": { key: "site-settings", label: "Site settings", to: "/site-settings" },
  publish: { key: "publish", label: "Publish", to: "/publish" },
  sponsors: { key: "sponsors", label: "Sponsors", to: "/sponsors" },
  "sponsors-order": { key: "sponsors-order", label: "Sponsor order", to: "/sponsors/order" },
  "cookie-types": { key: "cookie-types", label: "Cookie types", to: "/cookie-types" },
  cookies: { key: "cookies", label: "Cookies", to: "/cookies" },
  subscribers: { key: "subscribers", label: "Subscribers", to: "/subscribers" },
  people: { key: "people", label: "People", to: "/people" },
  "contact-messages": { key: "contact-messages", label: "Contact messages", to: "/contact-messages" },
  settings: { key: "settings", label: "Settings", to: "/settings" },
};

interface Props {
  role: Role;
  email: string;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  networkDown?: boolean;
}

export default function MainLayout({
  role,
  email,
  themeMode,
  onToggleTheme,
  networkDown = false,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { userManager } = useAuth();
  const config = useConfig();
  const location = useLocation();

  const entries = useMemo(() => navFor(role).map((k) => ALL_ENTRIES[k]), [role]);

  const handleSignOut = () => {
    void signOut(userManager, config);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6">WMSFO Admin</Typography>
      </Toolbar>
      <Divider />
      <List>
        {entries.map((e) => (
          <ListItemButton
            key={e.key}
            component={RouterLink}
            to={e.to}
            selected={location.pathname === e.to}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemText primary={e.label} />
          </ListItemButton>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen((p) => !p)}
              sx={{ mr: 2 }}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            WMSFO Admin
          </Typography>
          <Box sx={{ mr: 2 }}>
            <EnvBadge />
          </Box>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {email}
          </Typography>
          <IconButton color="inherit" onClick={onToggleTheme} aria-label="Toggle theme">
            {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={handleSignOut} aria-label="Sign out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
        <NetworkBanner visible={networkDown} />
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
