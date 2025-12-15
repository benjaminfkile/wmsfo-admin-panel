let protectedRoutePrefix: string | null = null;

export function setRuntimeConfig(
  prefix: string,
  auth: string,
  santaURL: string
) {
  protectedRoutePrefix = prefix;

  localStorage.setItem("protectedRoutePrefix", prefix);
  localStorage.setItem("chrisTrackerAuth", auth);
  localStorage.setItem("secretSanta", santaURL);
}

export function getProtectedRoutePrefix() {
  return (
    protectedRoutePrefix ??
    localStorage.getItem("protectedRoutePrefix")
  );
}
