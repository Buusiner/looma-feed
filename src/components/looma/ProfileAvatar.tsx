import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

type ProfileAvatarProps = {
  fullName: string;
  avatarUrl?: string | null | undefined;
  className?: string;
};

export function ProfileAvatar({ fullName, avatarUrl, className = "" }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <span className={`${className} looma-avatar-frame`} aria-hidden="true">
      {avatarUrl && !imageFailed ? (
        <img
          className="looma-avatar-image"
          src={avatarUrl}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <UserRound className="looma-avatar-anonymous" aria-hidden="true" />
      )}
    </span>
  );
}
