const STORAGE_KEY = "wmsfo_api_key";

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}
