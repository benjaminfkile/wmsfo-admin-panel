import { Box, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { Chrome } from "../../api/resources/themes";

interface Props {
  chrome: Chrome;
}

// The chrome strip over the theme preview (admin.md 6.28): the menu pill,
// a tile, the menu card, and the accent painted in the seven chrome
// colours along the map's bottom edge, so the chrome is judged against
// the map it sits on. Each piece carries its colours as data attributes.
export default function ChromeStrip({ chrome }: Props) {
  return (
    <Box
      data-testid="chrome-strip"
      aria-hidden="true"
      sx={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 8,
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
        flexWrap: "wrap",
      }}
    >
      <Box
        data-testid="chrome-pill"
        data-bg={chrome.bg}
        data-fg={chrome.fg}
        style={{ background: chrome.bg, color: chrome.fg }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          height: 36,
          borderRadius: 18,
          boxShadow: 2,
        }}
      >
        <MenuIcon fontSize="small" />
        <Typography variant="caption" sx={{ color: "inherit" }}>
          Menu
        </Typography>
      </Box>
      <Box
        data-testid="chrome-tile"
        data-tile={chrome.tile}
        data-tile-fg={chrome.tileFg}
        style={{ background: chrome.tile, color: chrome.tileFg }}
        sx={{
          width: 56,
          height: 56,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: "inherit", fontWeight: 600 }}>
          Tile
        </Typography>
      </Box>
      <Box
        data-testid="chrome-card"
        data-panel={chrome.panel}
        data-text={chrome.text}
        data-fg={chrome.fg}
        style={{ background: chrome.panel }}
        sx={{ px: 1.5, py: 1, borderRadius: 1, boxShadow: 2, minWidth: 120 }}
      >
        <Typography variant="body2" style={{ color: chrome.text }} sx={{ fontWeight: 600 }}>
          Menu card
        </Typography>
        <Typography variant="caption" style={{ color: chrome.fg }}>
          Secondary text
        </Typography>
        <Box
          data-testid="chrome-accent"
          data-accent={chrome.accent}
          style={{ background: chrome.accent }}
          sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
}
