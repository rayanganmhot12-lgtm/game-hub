import { Suspense } from "react";
import { getCurrentUser, isRawSteamId } from "@/lib/auth";
import PlatformBadge from "@/components/PlatformBadge";
import ConnectSuccessSound from "@/components/ConnectSuccessSound";
import ErrorToastFromQuery from "@/components/ErrorToastFromQuery";

const ERROR_MESSAGES: Record<string, string> = {
  steam_auth_failed: "Steam login failed to verify. Please try again.",
  steam_already_linked: "That Steam account is already connected to a different Game Hub account.",
};

export default async function ConnectPage() {
  const user = await getCurrentUser();
  const accounts = user?.accounts ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={null}>
        <ConnectSuccessSound />
        <ErrorToastFromQuery messages={ERROR_MESSAGES} />
      </Suspense>
      <h1 className="text-2xl font-bold text-foreground">Connections</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as <span className="text-foreground">{user?.email}</span>. Link platform
        accounts below to pull them into your unified library.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {accounts.map((a) => (
          <div key={a.id} className="panel flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <PlatformBadge platform={a.platform} />
              <span className="text-sm text-foreground">
                {isRawSteamId(a.displayName) ? user!.email.split("@")[0] : a.displayName}
              </span>
            </div>
            <span className="text-xs text-muted">
              {a.lastSyncedAt ? `Synced ${new Date(a.lastSyncedAt).toLocaleString()}` : "Not synced yet"}
            </span>
          </div>
        ))}

        {!accounts.some((a) => a.platform === "STEAM") && (
          <a href="/api/auth/steam" className="btn-primary py-3">
            Connect Steam
          </a>
        )}

        <div className="flex items-center justify-between rounded-xl border border-dashed border-border/70 bg-surface/20 p-4">
          <div className="flex items-center gap-3">
            <PlatformBadge platform="EPIC" />
            <span className="text-sm text-muted">Epic Games Store</span>
          </div>
          <span className="text-xs text-muted" title="Epic has no public API for reading a user's owned games yet">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
