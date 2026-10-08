import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { help } from "../api/resources/help";
import type { HelpTopic } from "../api/types";
import { keys } from "../queries/keys";

export const HELP_STALE_MS = 5 * 60 * 1000;

// Every help topic in one query, shared by every help button on the
// screen; the list changes only when an admin edits a topic, so it
// stays fresh for five minutes and a write invalidates it.
export function useHelpTopics() {
  const query = useQuery({
    queryKey: keys.help,
    queryFn: () => help.list(),
    staleTime: HELP_STALE_MS,
  });
  const byKey = useMemo(() => {
    const m = new Map<string, HelpTopic>();
    for (const t of query.data?.items ?? []) {
      if (t.key) m.set(t.key, t);
    }
    return m;
  }, [query.data]);
  const topicFor = useCallback(
    (key: string): HelpTopic | undefined => byKey.get(key),
    [byKey]
  );
  return { query, topics: query.data?.items ?? [], topicFor };
}
