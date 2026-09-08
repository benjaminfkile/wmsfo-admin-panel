export type ErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
  requestId: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ErrorBody | null
  ) {
    super(body?.message ?? `HTTP ${status}`);
    this.name = "ApiError";
  }

  get code(): string {
    return this.body?.code ?? (this.status === 405 ? "method_not_allowed" : "unknown");
  }

  get requestId(): string | null {
    return this.body?.requestId ?? null;
  }

  get fields(): Record<string, string> {
    const f = this.body?.details?.["fields"];
    if (!f || typeof f !== "object") return {};
    return Object.fromEntries(
      Object.entries(f as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string"
      )
    ) as Record<string, string>;
  }

  get retryAfterSeconds(): number | null {
    const v = this.body?.details?.["retryAfterSeconds"];
    return typeof v === "number" ? v : null;
  }
}

export class NetworkError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class AuthRequired extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AuthRequired";
  }
}

export class CdnError extends Error {
  constructor(public readonly status: number) {
    super(`CDN ${status}`);
    this.name = "CdnError";
  }
}
