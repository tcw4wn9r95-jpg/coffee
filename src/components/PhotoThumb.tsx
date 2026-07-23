import { useEffect, useState } from "react";
import { getPhoto } from "../lib/db";
import { CupIcon } from "./Icons";

export function usePhotoURL(photoId?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    if (!photoId) {
      setUrl(null);
      return;
    }
    getPhoto(photoId).then((blob) => {
      if (!alive || !blob) return;
      const u = URL.createObjectURL(blob);
      revoked = u;
      setUrl(u);
    });
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [photoId]);
  return url;
}

export function PhotoThumb({
  photoId,
  className = "thumb",
}: {
  photoId?: string;
  className?: string;
}) {
  const url = usePhotoURL(photoId);
  if (url) return <img src={url} className={className} alt="" />;
  return (
    <div className={`${className} thumb-fallback`}>
      <CupIcon size={26} />
    </div>
  );
}
