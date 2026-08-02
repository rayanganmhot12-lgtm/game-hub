"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, Trash2, Palette } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { CosmeticFrame, CosmeticBanner } from "@/components/CosmeticFrame";
import NebulaBackdrop from "@/components/NebulaBackdrop";

const AVATAR_SIZE = 256;
const BANNER_WIDTH = 600;
const BANNER_HEIGHT = 180;
const MAX_BIO_LENGTH = 190;
const MAX_PRONOUNS_LENGTH = 30;
const MAX_PROFILE_NOTE_LENGTH = 60;
const MAX_AVATAR_GIF_BYTES = 1.8 * 1024 * 1024;
const MAX_BANNER_GIF_BYTES = 2.6 * 1024 * 1024;
const ACCENT_PRESETS = ["#ff6b00", "#ff2d6b", "#a855f7", "#3b82f6", "#22c55e", "#eab308"];

function resizeToDataUrl(file: File, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas isn't supported in this browser."));
        return;
      }
      // Cover-fit crop: scale so the shorter side fills the target box, then
      // center-crop the overflow on the longer side.
      const scale = Math.max(width / img.width, height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = URL.createObjectURL(file);
  });
}

// Animated GIFs go straight through as-is (no canvas pass) — canvas would
// flatten them to a single static frame, killing the animation.
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export default function ProfileManager({
  initialDisplayName,
  initialAvatarDataUrl,
  initialBannerDataUrl,
  initialBio,
  initialPronouns,
  initialProfileNote,
  initialAccentColor,
  equippedFrame,
  equippedBanner,
  hasPlus,
}: {
  initialDisplayName: string;
  initialAvatarDataUrl: string | null;
  initialBannerDataUrl: string | null;
  initialBio: string | null;
  initialPronouns: string | null;
  initialProfileNote: string | null;
  initialAccentColor: string | null;
  equippedFrame: string | null;
  equippedBanner: string | null;
  hasPlus: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState(initialAvatarDataUrl);
  const [bannerDataUrl, setBannerDataUrl] = useState(initialBannerDataUrl);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [pronouns, setPronouns] = useState(initialPronouns ?? "");
  const [profileNote, setProfileNote] = useState(initialProfileNote ?? "");
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savingPronouns, setSavingPronouns] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  async function patchProfile(fields: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save.");
    return res.json();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      return;
    }
    if (file.type === "image/gif" && !hasPlus) {
      showToast("Animated GIF avatars need Game Hub Plus — grab it from the Store.", "error");
      return;
    }
    if (file.type === "image/gif" && file.size > MAX_AVATAR_GIF_BYTES) {
      showToast("That GIF is too big — keep it under 1.8MB.", "error");
      return;
    }
    setSavingPhoto(true);
    try {
      const dataUrl =
        file.type === "image/gif" ? await readFileAsDataUrl(file) : await resizeToDataUrl(file, AVATAR_SIZE, AVATAR_SIZE);
      await patchProfile({ avatarDataUrl: dataUrl });
      setAvatarDataUrl(dataUrl);
      showToast("Profile photo updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save photo.", "error");
    } finally {
      setSavingPhoto(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setSavingPhoto(true);
    try {
      await patchProfile({ avatarDataUrl: null });
      setAvatarDataUrl(null);
      showToast("Profile photo removed.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove photo.", "error");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      return;
    }
    if (file.type === "image/gif" && !hasPlus) {
      showToast("Animated GIF banners need Game Hub Plus — grab it from the Store.", "error");
      return;
    }
    if (file.type === "image/gif" && file.size > MAX_BANNER_GIF_BYTES) {
      showToast("That GIF is too big — keep it under 2.6MB.", "error");
      return;
    }
    setSavingBanner(true);
    try {
      const dataUrl =
        file.type === "image/gif" ? await readFileAsDataUrl(file) : await resizeToDataUrl(file, BANNER_WIDTH, BANNER_HEIGHT);
      await patchProfile({ bannerDataUrl: dataUrl });
      setBannerDataUrl(dataUrl);
      showToast("Banner updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save banner.", "error");
    } finally {
      setSavingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function handleRemoveBanner() {
    setSavingBanner(true);
    try {
      await patchProfile({ bannerDataUrl: null });
      setBannerDataUrl(null);
      showToast("Banner removed.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove banner.", "error");
    } finally {
      setSavingBanner(false);
    }
  }

  async function handleSaveName() {
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      showToast("Username can't be empty.", "error");
      return;
    }
    if (trimmed === initialDisplayName) return;
    setSavingName(true);
    try {
      await patchProfile({ displayName: trimmed });
      showToast("Username updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save username.", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveBio() {
    if (bio.trim() === (initialBio ?? "").trim()) return;
    setSavingBio(true);
    try {
      await patchProfile({ bio });
      showToast("Bio updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save bio.", "error");
    } finally {
      setSavingBio(false);
    }
  }

  async function handleSavePronouns() {
    if (pronouns.trim() === (initialPronouns ?? "").trim()) return;
    setSavingPronouns(true);
    try {
      await patchProfile({ pronouns: pronouns.trim() || null });
      showToast("Pronouns updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save pronouns.", "error");
    } finally {
      setSavingPronouns(false);
    }
  }

  async function handleSaveNote() {
    if (profileNote.trim() === (initialProfileNote ?? "").trim()) return;
    setSavingNote(true);
    try {
      await patchProfile({ profileNote: profileNote.trim() || null });
      showToast("Note updated.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save note.", "error");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSetAccentColor(color: string | null) {
    setSavingColor(true);
    try {
      await patchProfile({ accentColor: color });
      setAccentColor(color);
      showToast(color ? "Profile color updated." : "Profile color reset.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save color.", "error");
    } finally {
      setSavingColor(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="relative">
        {equippedBanner === "banner-nebula" && <NebulaBackdrop />}
        <div
          className="panel overflow-hidden !p-0"
          style={accentColor ? { borderColor: accentColor, boxShadow: `0 0 24px -6px ${accentColor}` } : undefined}
        >
        <div className="relative h-32 w-full bg-surface-2">
          <CosmeticBanner bannerId={equippedBanner}>
            {bannerDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
              <img src={bannerDataUrl} alt="Profile banner" className="h-32 w-full object-cover" />
            ) : (
              <div className="h-32 w-full bg-gradient-to-br from-surface-2 to-surface" />
            )}
          </CosmeticBanner>

          <div className="absolute -bottom-10 left-6">
            <CosmeticFrame frameId={equippedFrame}>
              {avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                <img
                  src={avatarDataUrl}
                  alt="Your profile photo"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-surface"
                />
              ) : (
                <div className="icon-badge h-20 w-20 ring-4 ring-surface">
                  <Camera size={24} />
                </div>
              )}
            </CosmeticFrame>
          </div>

          <div className="absolute right-3 top-3 flex gap-2">
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={savingBanner}
              className="btn-ghost !bg-black/40 !px-2.5 !py-1.5 !text-xs backdrop-blur"
              title={bannerDataUrl ? "Change banner" : "Upload banner"}
            >
              <ImageIcon size={13} />
            </button>
            {bannerDataUrl && (
              <button
                onClick={handleRemoveBanner}
                disabled={savingBanner}
                className="btn-ghost !bg-black/40 !px-2.5 !py-1.5 !text-xs backdrop-blur"
                title="Remove banner"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 px-4 pb-4 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={savingPhoto}
              className="btn-primary !text-xs disabled:opacity-50"
            >
              <Camera size={14} />
              {avatarDataUrl ? "Change Photo" : "Upload Photo"}
            </button>
            {avatarDataUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={savingPhoto}
                className="btn-ghost !text-xs disabled:opacity-50"
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {!hasPlus && (
            <p className="text-[11px] text-muted">
              Animated GIF photo/banner needs <span className="text-accent-bright">Game Hub Plus</span>
            </p>
          )}
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          disabled={savingPhoto}
          className="hidden"
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={handleBannerChange}
          disabled={savingBanner}
          className="hidden"
        />
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-6">
        <label className="text-sm font-semibold text-foreground">Username</label>
        <p className="text-xs text-muted">
          Shown to friends in chat, calls, groups, and moderation instead of your email.
        </p>
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="input-field flex-1"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || displayName.trim() === initialDisplayName}
            className="btn-primary !text-xs disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-6">
        <label className="text-sm font-semibold text-foreground">Bio</label>
        <p className="text-xs text-muted">Shown on your profile card to friends.</p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO_LENGTH}
          rows={3}
          placeholder="Say something about yourself…"
          className="input-field resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">
            {bio.length}/{MAX_BIO_LENGTH}
          </span>
          <button
            onClick={handleSaveBio}
            disabled={savingBio || bio.trim() === (initialBio ?? "").trim()}
            className="btn-primary !text-xs disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-6">
        <label className="text-sm font-semibold text-foreground">Pronouns</label>
        <p className="text-xs text-muted">Shown under your name on your profile card, e.g. &quot;she/her&quot; or &quot;they/them&quot;.</p>
        <div className="flex gap-2">
          <input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            maxLength={MAX_PRONOUNS_LENGTH}
            placeholder="she/her"
            className="input-field flex-1"
          />
          <button
            onClick={handleSavePronouns}
            disabled={savingPronouns || pronouns.trim() === (initialPronouns ?? "").trim()}
            className="btn-primary !text-xs disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-6">
        <label className="text-sm font-semibold text-foreground">Custom Note</label>
        <p className="text-xs text-muted">A short status line under your name — separate from your bio below.</p>
        <div className="flex gap-2">
          <input
            value={profileNote}
            onChange={(e) => setProfileNote(e.target.value)}
            maxLength={MAX_PROFILE_NOTE_LENGTH}
            placeholder="What's on your mind?"
            className="input-field flex-1"
          />
          <button
            onClick={handleSaveNote}
            disabled={savingNote || profileNote.trim() === (initialProfileNote ?? "").trim()}
            className="btn-primary !text-xs disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette size={15} className="text-accent-bright" />
          Profile Color
        </label>
        <p className="text-xs text-muted">
          {hasPlus ? "Colors your profile card border for friends." : (
            <>
              Custom profile color needs <span className="text-accent-bright">Game Hub Plus</span>.
            </>
          )}
        </p>
        {hasPlus && (
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => handleSetAccentColor(c)}
                disabled={savingColor}
                title={c}
                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110 ${
                  accentColor === c ? "ring-2 ring-foreground" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={accentColor ?? "#ff6b00"}
              onChange={(e) => handleSetAccentColor(e.target.value)}
              disabled={savingColor}
              className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              title="Custom color"
            />
            {accentColor && (
              <button
                onClick={() => handleSetAccentColor(null)}
                disabled={savingColor}
                className="btn-ghost !px-2.5 !py-1.5 !text-xs"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
