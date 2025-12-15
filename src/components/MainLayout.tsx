import { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Box,
  IconButton,
  CssBaseline,
  Divider,
  useTheme,
  useMediaQuery,
  Collapse,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

/* Pages */
import Dashboard from "../pages/Dashboard";
import TrackingMode from "../pages/TrackingMode";
import EventModeOverride from "../pages/EventModeOverride";
import EventMessage from "../pages/EventMessage";
import FundsStatus from "../pages/FundsStatus";
import EventMode from "../pages/EventMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";



const drawerWidth = 220;

interface Props {
  onToggleTheme: () => void;
  themeMode: "light" | "dark";
}


export default function MainLayout(props: Props) {

  const { onToggleTheme, themeMode } = props

  const [mobileOpen, setMobileOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [trackerOpen, setTrackerOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6">406 Santa</Typography>
      </Toolbar>

      <Divider />

      <List>
        {/* ================= DASHBOARD ================= */}
        <ListItemButton
          component={Link}
          to="/"
          onClick={() => setMobileOpen(false)}
        >
          <ListItemText primary="Dashboard" />
        </ListItemButton>

        {/* ================= SETTINGS ================= */}
        <ListItemButton onClick={() => setSettingsOpen((o) => !o)}>
          <ListItemText primary="Settings" />
          {settingsOpen ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>

        <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>

            <ListItemButton
              component={Link}
              to="/event-message"
              sx={{ pl: 4 }}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemText primary="Event Message" />
            </ListItemButton>

            <ListItemButton
              component={Link}
              to="/funds"
              sx={{ pl: 4 }}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemText primary="Cheer Meter" />
            </ListItemButton>

            {/* -------- Tracker Settings -------- */}
            <ListItemButton
              sx={{ pl: 4 }}
              onClick={() => setTrackerOpen((o) => !o)}
            >
              <ListItemText primary="Tracker Settings" />
              {trackerOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>

            <Collapse in={trackerOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>

                <ListItemButton
                  component={Link}
                  to="/event-mode"
                  sx={{ pl: 6 }}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemText primary="Event Mode" />
                </ListItemButton>

                <ListItemButton
                  component={Link}
                  to="/tracking-mode"
                  sx={{ pl: 6 }}
                  onClick={() => setMobileOpen(false)}
                >
                  <ListItemText primary="Tracking Mode" />
                </ListItemButton>

                {/* -------- Advanced -------- */}
                <ListItemButton
                  sx={{ pl: 6 }}
                  onClick={() => setAdvancedOpen((o) => !o)}
                >
                  <ListItemText primary="Advanced" />
                  {advancedOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>

                <Collapse in={advancedOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItemButton
                      component={Link}
                      to="/event-mode-override"
                      sx={{ pl: 6 }}
                      onClick={() => setMobileOpen(false)}
                    >
                      <ListItemText primary="Event Mode Override" />
                    </ListItemButton>
                  </List>
                </Collapse>

              </List>
            </Collapse>

          </List>
        </Collapse>
      </List>
    </div>
  );

  return (
    <BrowserRouter>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />

        {/* ================= APP BAR ================= */}
        <AppBar
          position="fixed"
          sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
              WMSFO Admin
            </Typography>

            <IconButton color="inherit" onClick={onToggleTheme}>
              {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>
        ◊

        {/* ================= DRAWER ================= */}
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          {/* Mobile */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": { width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>

          {/* Desktop */}
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

        {/* ================= MAIN CONTENT ================= */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 2,
            width: { md: `calc(100% - ${drawerWidth}px)` },
          }}
        >
          <Toolbar />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/event-message" element={<EventMessage />} />
            <Route path="/funds" element={<FundsStatus />} />
            <Route path="/tracking-mode" element={<TrackingMode />} />
            <Route path="/event-mode-override" element={<EventModeOverride />} />
            <Route path="/event-mode" element={<EventMode />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
