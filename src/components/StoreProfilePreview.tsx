import { CosmeticFrame, CosmeticBadge, CosmeticBanner } from "@/components/CosmeticFrame";
import { formatFriendCode } from "@/lib/friendCode";
import NebulaBackdrop from "@/components/NebulaBackdrop";

export default function StoreProfilePreview({
  displayName,
  avatarDataUrl,
  bannerDataUrl,
  friendCode,
  equippedFrame,
  equippedBadge,
  equippedBanner,
  nameEffect,
  nameEffectColor1,
  nameEffectColor2,
}: {
  displayName: string;
  avatarDataUrl: string | null;
  bannerDataUrl: string | null;
  friendCode: string;
  equippedFrame: string | null;
  equippedBadge: string | null;
  equippedBanner: string | null;
  nameEffect: string | null;
  nameEffectColor1: string | null;
  nameEffectColor2: string | null;
}) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const nameIsGradient = nameEffect === "gradient-cycle";
  const nameGradientStyle =
    nameIsGradient && nameEffectColor1 && nameEffectColor2
      ? ({ "--name-color-1": nameEffectColor1, "--name-color-2": nameEffectColor2 } as React.CSSProperties)
      : undefined;

  return (
    <div className="relative w-full">
      {equippedBanner === "banner-nebula" && <NebulaBackdrop />}
      <div className="panel relative w-full overflow-hidden !p-0 text-center">
        <div className="relative h-24 w-full bg-surface-2">
          <CosmeticBanner bannerId={equippedBanner}>
            {bannerDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
              <img src={bannerDataUrl} alt="" className="h-24 w-full object-cover" />
            ) : (
              <div className="h-24 w-full bg-gradient-to-br from-surface-2 to-surface" />
            )}
          </CosmeticBanner>
        </div>

        <div className="flex flex-col items-center px-6 pb-6">
          <div className="relative -mt-10">
            <CosmeticFrame frameId={equippedFrame}>
              {avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                <img
                  src={avatarDataUrl}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-surface"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-2xl font-semibold text-black ring-4 ring-surface">
                  {initial}
                </span>
              )}
            </CosmeticFrame>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h2
              className={`text-lg font-bold ${nameIsGradient ? "name-gradient-cycle" : "text-foreground"}`}
              style={nameGradientStyle}
            >
              {displayName}
            </h2>
            <CosmeticBadge badgeId={equippedBadge} />
          </div>
          <p className="mt-1 text-xs text-muted">{formatFriendCode(friendCode)}</p>
        </div>
      </div>
    </div>
  );
}
