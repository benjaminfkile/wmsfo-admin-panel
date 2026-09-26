import { useQuery } from "@tanstack/react-query";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";
import type { MediaAsset } from "../../../api/types";

interface Props {
  mediaId: string;
}

// Renders the filename of the picked media, falling back to the id
// when the lookup has not resolved. Used as a block header summary.
export default function MediaFilename({ mediaId }: Props) {
  const enabled = typeof mediaId === "string" && mediaId.length > 0;
  const q = useQuery({
    queryKey: keys.mediaAsset(mediaId),
    queryFn: () => mediaApi.get(mediaId),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
  if (!enabled) return <>No media</>;
  const asset = q.data as MediaAsset | undefined;
  return <>{asset?.filename ?? mediaId}</>;
}
