import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Config } from "./config";

const ConfigContext = createContext<Config | null>(null);

export function useConfig(): Config {
  const c = useContext(ConfigContext);
  if (!c) throw new Error("useConfig must be used inside ConfigProvider");
  return c;
}

interface Props {
  config: Config;
  children: ReactNode;
}

export function ConfigProvider({ config, children }: Props) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}
