import { Alert, Snackbar } from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type Severity = "success" | "info" | "warning" | "error";
type Message = { id: number; text: string; severity: Severity };

type Notify = (text: string, severity?: Severity) => void;

const Ctx = createContext<Notify | null>(null);

export function useNotify(): Notify {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotify must be used inside NotifyProvider");
  return ctx;
}

let nextId = 1;

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Message | null>(null);

  const notify = useCallback<Notify>((text, severity = "success") => {
    setCurrent({ id: nextId++, text, severity });
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={current !== null}
        autoHideDuration={4000}
        onClose={() => setCurrent(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {current ? (
          <Alert
            severity={current.severity}
            variant="filled"
            onClose={() => setCurrent(null)}
          >
            {current.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Ctx.Provider>
  );
}
