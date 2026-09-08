import { CdnError } from "./errors";
import type { LiveObject } from "./types";

type CdnDeps = { cdnBaseUrl: string };

let deps: CdnDeps | null = null;

export function installCdn(d: CdnDeps): void {
  deps = d;
}

function need(): CdnDeps {
  if (!deps) throw new Error("CDN client not installed");
  return deps;
}

export async function fetchLiveObject(): Promise<LiveObject> {
  const { cdnBaseUrl } = need();
  const res = await fetch(`${cdnBaseUrl}/live/location.json`, {
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) throw new CdnError(res.status);
  return (await res.json()) as LiveObject;
}
