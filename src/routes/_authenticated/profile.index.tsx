import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  Info,
  LifeBuoy,
  LogOut,
  MessageSquareHeart,
  Shield,
  Star,
  User,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/profile.functions";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "Profile — NovaMind AI" },
      { name: "description", content: "Manage your NovaMind AI profile, privacy, support and app information." },
      { property: "og:title", content: "Profile — NovaMind AI" },
      { property: "og:description", content: "Manage your NovaMind AI profile, privacy, support and app information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileHub,
});

function Row({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-accent"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function ProfileHub() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <PageShell title="Profile" subtitle="Your account and app settings" backTo="/">
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        {data?.avatar_url ? (
          <img src={data.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <User className="h-7 w-7" />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{data?.display_name ?? "Your profile"}</div>
          <div className="truncate text-sm text-muted-foreground">
            {data?.username ? `@${data.username}` : data?.email ?? ""}
          </div>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              data?.plan === "premium" ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {(data?.plan ?? "free").toUpperCase()}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Row
          to="/profile/personal"
          icon={<User className="h-4 w-4" />}
          label="Personal Information"
          hint="Profile picture, display name and username"
        />
        <Row
          to="/profile/privacy"
          icon={<Shield className="h-4 w-4" />}
          label="Privacy Policy"
          hint="How your information is handled"
        />
        <Row
          to="/profile/support"
          icon={<LifeBuoy className="h-4 w-4" />}
          label="Contact Support"
          hint="Report a problem or ask for help"
        />
        <Row
          to="/profile/feedback"
          icon={<MessageSquareHeart className="h-4 w-4" />}
          label="Send Feedback"
          hint="Rate NovaMind AI and share your thoughts"
        />
        <Row
          to="/profile/about"
          icon={<Info className="h-4 w-4" />}
          label="About NovaMind AI"
          hint="What NovaMind AI is and who built it"
        />
      </div>

      {data?.isAdmin && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Administration
          </div>
          <Row
            to="/admin/reviews"
            icon={<Star className="h-4 w-4" />}
            label="Reviews Dashboard"
            hint="All user reviews, ratings and replies"
          />
          <Row
            to="/admin/support"
            icon={<LifeBuoy className="h-4 w-4" />}
            label="Support Dashboard"
            hint="Support requests from users"
          />
          <Row
            to="/admin/errors"
            icon={<Wrench className="h-4 w-4" />}
            label="Error Reports"
            hint="Automatic failure reports from the app"
          />
        </div>
      )}

      <button
        onClick={signOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </PageShell>
  );
}
