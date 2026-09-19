import { Alert } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { email as emailApi } from "../api/resources/email";
import { keys } from "../queries/keys";

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function EmailQuotaNotice() {
  const q = useQuery({
    queryKey: keys.emailQuota,
    queryFn: () => emailApi.quota(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (q.isLoading) return null;

  const data = q.data;

  if (q.error || !data) {
    return (
      <Alert severity="info" data-testid="email-quota-unknown">
        The email quota could not be checked, so the panel cannot tell whether this send fits.
      </Alert>
    );
  }

  if (data.dryRun === true) return null;

  if (data.available === false) {
    return (
      <Alert severity="info" data-testid="email-quota-unknown">
        The email quota could not be checked, so the panel cannot tell whether this send fits.
      </Alert>
    );
  }

  if (data.wouldExceed !== true) return null;

  const remaining = toNumber(data.remaining) ?? 0;
  const sentLast24Hours = toNumber(data.sentLast24Hours) ?? 0;
  const queued = toNumber(data.queued) ?? 0;
  const max24HourSend = toNumber(data.max24HourSend) ?? 0;
  const verifiedSubscribers = toNumber(data.verifiedSubscribers) ?? 0;
  const overflow = Math.max(0, verifiedSubscribers - remaining);

  return (
    <Alert severity="warning" data-testid="email-quota-warning">
      This send may not reach everyone. SES allows {remaining.toLocaleString()} more emails in the next 24 hours ({sentLast24Hours.toLocaleString()} sent, {queued.toLocaleString()} waiting, limit {max24HourSend.toLocaleString()}) and there are {verifiedSubscribers.toLocaleString()} verified subscribers, so about {overflow.toLocaleString()} would be refused.
    </Alert>
  );
}
