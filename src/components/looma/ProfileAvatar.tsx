import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useStorageUrl } from "@/lib/use-storage-url";

type ProfileAvatarProps = {
  fullName: string;
  avatarUrl?: string | null | undefined;
  className?: string;
};

function getStorageReference(avatarUrl: string | null | undefined) {
  const match = avatarUrl?.match(/^storage:([^/]+)\/(.+)$/);
  return match ? { bucket: match[1], path: match[2] } : null;
}

export function ProfileAvatar({ fullName, avatarUrl, className = "" }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const storageReference = getStorageReference(avatarUrl);
  const { url: signedUrl, retry } = useStorageUrl(
    storageReference?.bucket ?? "profile-media",
    storageReference?.path,
  );
  const imageUrl = storageReference ? signedUrl : avatarUrl;

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <span className={`${className} looma-avatar-frame`} aria-hidden="true">
      {imageUrl && !imageFailed ? (
        <img
          className="looma-avatar-image"
          src={imageUrl}
          alt=""
          onError={() => {
            setImageFailed(true);
            if (storageReference) retry();
          }}
        />
      ) : (
        <UserRound className="looma-avatar-anonymous" aria-hidden="true" />
      )}
    </span>
  );
}
