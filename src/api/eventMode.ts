import { AxiosInstance } from "axios";
import { getProtectedRoutePrefix } from "../auth/runtimeConfig";

function getChrisAuth() {
  const auth = localStorage.getItem("chrisTrackerAuth");
  if (!auth) throw new Error("Missing chrisTrackerAuth");
  return auth;
}

function getSecretSanta() {
  const secretSanta = localStorage.getItem("secretSanta");
  if (!secretSanta) throw new Error("Missing secretSanta");
  return secretSanta;
}

export const createEventModeApi = (c: AxiosInstance) => ({
  async setMode(value: 0 | 2): Promise<void> {
    const auth = getChrisAuth();
    const secretSanta = getSecretSanta();

    // fire-and-forget legacy API
    fetch(`${secretSanta}/mode?auth=${auth}&id=406santa&value=${value}`).catch(
      () => {}
    );
  },

  async runShow(): Promise<void> {
    const prefix = getProtectedRoutePrefix();
    if (!prefix) throw new Error("Missing protectedRoutePrefix");

    // authoritative internal state change
    await c.post(`/api/${prefix}/liftoff`);

    const auth = getChrisAuth();
    const secretSanta = getSecretSanta();

    // fire-and-forget legacy tracker switch
    fetch(`${secretSanta}/mode?auth=${auth}&id=406santa&value=1`).catch(
      () => {}
    );
  },
});
