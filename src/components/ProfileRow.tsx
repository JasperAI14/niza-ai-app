import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, User } from "lucide-react";
import { getProfile } from "@/lib/profile.functions";

export function ProfileRow() {
  const fetchProfile = useServerFn(getProfile);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const name = data?.display_name || "Your profile";
  const sub = data?.username ? `@${data.username}` : data?.email || "Tap to set up";

  return (
    <Link
      to="/profile"
      className="m-3 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:bg-accent"
      aria-label="Open profile"
    >
      {data?.avatar_url ? (
        <img
          src={data.avatar_url}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <User className="h-4.5 w-4.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
