import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getConfiguredApiUrl } from "@/lib/api-base-url";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// HSL-based colors generated from name hash — warm, saturated palette
// tuned for white text readability
const AVATAR_HUES = [174, 16, 262, 200, 340, 38, 152, 290, 120, 60];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
  return `hsl(${hue}, 55%, 42%)`;
}

const API_URL = getConfiguredApiUrl();

function resolveAvatarUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url}`;
}

export function UserAvatar({
  name,
  avatarUrl,
  size = "default",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "default" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "h-6 w-6 text-2xs",
    default: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
    xl: "h-20 w-20 text-2xl",
  }[size];

  const bgColor = getAvatarColor(name);
  const resolvedUrl = avatarUrl ? resolveAvatarUrl(avatarUrl) : null;

  return (
    <Avatar
      className={`${sizeClass} hover:scale-110 hover:shadow-md cursor-default`}
    >
      {resolvedUrl && (
        <AvatarImage src={resolvedUrl} alt={name} className="object-cover" />
      )}
      <AvatarFallback
        className="text-white font-heading font-semibold"
        style={{ backgroundColor: bgColor }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
