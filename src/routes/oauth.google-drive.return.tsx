import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google-drive/return")({
  head: () => ({
    meta: [
      { title: "Connecting Google Drive — Niza Prime AI" },
      { name: "description", content: "Finishing your Google Drive connection to Niza Prime AI." },
      { property: "og:title", content: "Connecting Google Drive — Niza Prime AI" },
      { property: "og:description", content: "Finishing your Google Drive connection to Niza Prime AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriveReturn,
});

function DriveReturn() {
  const [message, setMessage] = useState("Finishing connection…");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", code?: string) => {
      window.opener?.postMessage({ type, connectorId: "google_drive", code: code ?? null }, window.location.origin);
      window.close();
    };
    if (p.get("success") !== "true") {
      setMessage("Google Drive wasn't connected. You can close this window.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = p.get("code");
    if (!code) {
      if (p.get("offline_access_allowed") === "false") return notify("appUserConnectorOAuthComplete");
      setMessage("Connection didn't finish. Please try again.");
      return notify("appUserConnectorOAuthFailed");
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);
  return <p className="p-6 text-center text-sm text-muted-foreground">{message}</p>;
}
