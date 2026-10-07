import { useMutation, useQueryClient } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { ApiError } from "../../api/errors";
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";

// The publish write shared by the Publish page and the bar's Publish
// button: posts the label, toasts the new version, and refreshes the
// status and the versions list. A `content_invalid` answer refreshes the
// status so the problem list shows what blocks publishing.
export function usePublishMutation() {
  const qc = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (label: string | null) => contentApi.publish(label),
    onSuccess: (v) => {
      notify(`Published version ${String(v.id ?? "")}`);
      void qc.invalidateQueries({ queryKey: keys.contentStatus });
      void qc.invalidateQueries({ queryKey: keys.versions });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "content_invalid") {
        void qc.invalidateQueries({ queryKey: keys.contentStatus });
      }
    },
  });
}
