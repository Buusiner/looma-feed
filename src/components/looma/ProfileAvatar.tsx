import { useEffect, useState } from "react";
import { getInitials } from "@/lib/profile";

type ProfileAvatarProps = {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
};

export function ProfileAvatar({ fullName, avatarUrl, className = "" }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <span className={className} aria-hidden="true">
      {avatarUrl && !imageFailed ? (
        <img src={avatarUrl} alt="" onError={() => setImageFailed(true)} />
      ) : (
        getInitials(fullName)
      )}
    </span>
  );
}
