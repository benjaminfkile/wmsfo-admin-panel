import { useQuery } from "@tanstack/react-query";
import { icons as iconsApi } from "../../../api/resources/icons";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";

interface Props {
  icon: Icon;
}

// Renders the human name of a picked icon: the library name for a
// library icon, the filename for a media-sourced icon; falls back to
// the id when neither has resolved. Used as a block header summary.
export default function IconName({ icon }: Props) {
  const isLibrary = icon.source === "library";
  const isMedia = icon.source === "media";
  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: isLibrary,
    staleTime: Infinity,
  });
  const mediaQ = useQuery({
    queryKey: keys.mediaAsset(String(icon.id ?? "")),
    queryFn: () => mediaApi.get(String(icon.id ?? "")),
    enabled: isMedia && typeof icon.id === "string" && icon.id.length > 0,
    staleTime: Infinity,
    retry: false,
  });
  if (isLibrary) {
    const found = (iconsQ.data?.items ?? []).find(
      (i: IconInfo) => i.id === icon.id
    );
    return <>{found?.name ?? String(icon.id ?? "")}</>;
  }
  if (isMedia) {
    const asset = mediaQ.data as MediaAsset | undefined;
    return <>{asset?.filename ?? String(icon.id ?? "")}</>;
  }
  return <>{String(icon.id ?? "")}</>;
}
