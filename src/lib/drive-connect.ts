// Browser-safe popup helper for connecting Google Drive.
function waitForCode(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (e: MessageEvent) => {
      const type = e.data?.type;
      if (
        e.origin !== window.location.origin ||
        e.source !== popup ||
        e.data?.connectorId !== "google_drive" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") resolve(typeof e.data?.code === "string" ? e.data.code : null);
      else {
        popup.close();
        reject(new Error("Google Drive access wasn't granted."));
      }
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window was closed before finishing."));
    }, 500);
  });
}

export async function connectDriveFlow(
  start: () => Promise<{ authorizationUrl: string }>,
  complete: (code: string) => Promise<unknown>,
) {
  const popup = window.open("", "niza-drive-oauth", "width=600,height=720");
  if (!popup) throw new Error("Your browser blocked the Google window. Allow pop-ups and try again.");
  let code: string | null;
  try {
    const { authorizationUrl } = await start();
    const done = waitForCode(popup);
    popup.location.href = authorizationUrl;
    code = await done;
  } catch (e) {
    popup.close();
    throw e;
  }
  if (code) await complete(code);
}
