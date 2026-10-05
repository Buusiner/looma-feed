import { useEffect, useState } from "react";
import { useStorageUrl } from "@/lib/use-storage-url";

export function PostMedia({ path, type }: { path?: string | null; type?: string | null }) {
  const { url, retry } = useStorageUrl("post-media", path);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);
  if (!path) return null;
  if (!url || failed)
    return (
      <button
        type="button"
        className="post-media-placeholder"
        onClick={() => {
          setFailed(false);
          retry();
        }}
      >
        Carregar mídia
      </button>
    );
  return type?.startsWith("video/") ? (
    <video
      className={`post-media ${loaded ? "" : "post-media-loading"}`}
      src={url}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  ) : (
    <img
      className={`post-media ${loaded ? "" : "post-media-loading"}`}
      src={url}
      alt="Foto da publicação"
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}
