import { QueryClient } from "@tanstack/react-query";

export const POLL_MS = 5000;

export const polled = {
  refetchInterval: POLL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
