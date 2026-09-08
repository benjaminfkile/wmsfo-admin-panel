import { http, HttpResponse, type HttpHandler } from "msw";

export const handlers: HttpHandler[] = [
  http.get("*/admin/events", () => HttpResponse.json({ items: [] })),
];
