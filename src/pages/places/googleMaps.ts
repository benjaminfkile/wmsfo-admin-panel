import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

// admin.md 6.24: the Google map uses the site's key
// (VITE_GOOGLE_MAPS_KEY) via @googlemaps/js-api-loader. `setOptions`
// runs once per key so the JS API is fetched with the right auth.
let optionsSetForKey: string | null = null;

function ensureOptions(apiKey: string): void {
  if (optionsSetForKey === apiKey) return;
  setOptions({ key: apiKey, v: "weekly" });
  optionsSetForKey = apiKey;
}

export async function loadMaps(
  apiKey: string,
): Promise<google.maps.MapsLibrary> {
  ensureOptions(apiKey);
  return importLibrary("maps");
}

export async function loadMarkers(
  apiKey: string,
): Promise<google.maps.MarkerLibrary> {
  ensureOptions(apiKey);
  return importLibrary("marker");
}

export async function loadPlaces(
  apiKey: string,
): Promise<google.maps.PlacesLibrary> {
  ensureOptions(apiKey);
  return importLibrary("places");
}
