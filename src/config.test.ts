import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

function envFrom(overrides: Partial<Record<string, string>>): ImportMetaEnv {
  const base = {
    VITE_ENV: "dev",
    VITE_API_BASE_URL: "https://api.example.com/",
    VITE_CDN_BASE_URL: "https://cdn.example.com//",
    VITE_COGNITO_AUTHORITY: "https://cognito-idp.us-west-2.amazonaws.com/pool-id/",
    VITE_COGNITO_DOMAIN: "https://auth.example.com/",
    VITE_COGNITO_CLIENT_ID: "client-abc",
    ...overrides,
  } as unknown as ImportMetaEnv;
  return base;
}

describe("loadConfig", () => {
  it("returns a stripped config when every variable is present", () => {
    const result = loadConfig(envFrom({}));
    expect("missing" in result).toBe(false);
    if ("config" in result) {
      expect(result.config.env).toBe("dev");
      expect(result.config.apiBaseUrl).toBe("https://api.example.com");
      expect(result.config.cdnBaseUrl).toBe("https://cdn.example.com");
      expect(result.config.cognitoAuthority).toBe(
        "https://cognito-idp.us-west-2.amazonaws.com/pool-id"
      );
      expect(result.config.cognitoDomain).toBe("https://auth.example.com");
      expect(result.config.cognitoClientId).toBe("client-abc");
    }
  });

  it("accepts prod, dev, and local for VITE_ENV", () => {
    for (const env of ["prod", "dev", "local"]) {
      const result = loadConfig(envFrom({ VITE_ENV: env }));
      expect("config" in result).toBe(true);
    }
  });

  it("reports every missing variable", () => {
    const result = loadConfig(
      envFrom({ VITE_API_BASE_URL: "", VITE_CDN_BASE_URL: "   " })
    );
    expect("missing" in result).toBe(true);
    if ("missing" in result) {
      expect(result.missing).toContain("VITE_API_BASE_URL");
      expect(result.missing).toContain("VITE_CDN_BASE_URL");
    }
  });

  it("rejects a bogus VITE_ENV value", () => {
    const result = loadConfig(envFrom({ VITE_ENV: "staging" }));
    expect("missing" in result).toBe(true);
    if ("missing" in result) {
      expect(
        result.missing.some((m) => m.startsWith("VITE_ENV"))
      ).toBe(true);
    }
  });
});
