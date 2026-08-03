"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  MonitorUp,
  MonitorOff,
  ChevronDown,
  Check,
  HeadphoneOff,
} from "lucide-react";
import { useGroupCall } from "@/context/GroupCallContext";
import { useCall } from "@/context/CallContext";
import { useToast } from "@/context/ToastContext";
import { useDraggable } from "@/hooks/useDraggable";
import { useFullscreen } from "@/hooks/useFullscreen";
import ProfileAvatar from "@/components/ProfileAvatar";

const POSITION_STORAGE_KEY = "gamehub-call-window-position";

interface Tile {
  code: string;
  displayName: string;
  stream: MediaStream | null;
  // Whether this tile's <video> element should play its stream's audio.
  // The three tile kinds each need a different answer: the local "me" tile
  // Published by the person themselves, so a silent tile is distinguishable
  // from a muted one. Deafened outranks muted in the badge: deafening already
  // implies a muted mic, and "cannot hear you" is the more useful fact.
  micMuted?: boolean;
  deafened?: boolean;
  // must never play back your own mic (instant self-echo the moment your
  // camera is on); group peer tiles must stay muted too, since
  // GroupCallContext already renders its own per-peer <audio> element for
  // every peer independent of video state, and a peer's video/audio tracks
  // share the same MediaStream, so an unmuted video tile would double up
  // that same audio; the 1:1 direct peer tile must NOT be muted, since
  // CallContext no longer renders any <audio> element of its own (removed
  // in Task 3 specifically so this video tile would be the sole playback
  // sink) — muting it here would go silent whenever that peer's camera is
  // off, a regression versus the old audio-only call experience.
  muted: boolean;
}

// Whether a tile should show live video is NOT the same question as
// "does a video track object currently exist on this stream" — turning a
// camera off calls RTCRtpSender.replaceTrack(null) rather than removing
// the track from the connection (so no renegotiation is needed to turn it
// back on), and the *receiving* side's track object doesn't disappear when
// that happens — it just stops getting real frames. The standards-correct
// signal for "is this track actually receiving/producing frames right
// now" is the track's own `mute`/`unmute` events and its `.muted`
// property, which is what this hook watches instead of track presence.
//
// The effect below is deliberately keyed on the video TRACK, not on the
// MediaStream: every path that turns a camera on mid-call mutates the
// EXISTING stream in place (`stream.addTrack(track)`) rather than building a
// new one, and the 1:1/group `ontrack` handlers are handed back the same
// MediaStream object the browser already created for that stream id. Keying
// on `[stream]` therefore never re-fired — the object identity is unchanged —
// so `live` stayed false forever and no video ever rendered. The track object,
// by contrast, is stable while the camera is genuinely still on and only
// appears/disappears on addTrack/removeTrack, which is exactly the transition
// this needs to notice. Computing it during render (rather than inside the
// effect) is what lets it act as a dependency at all.
function useTrackLive(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0] ?? null;
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!track) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLive(false);
      return;
    }
    setLive(!track.muted);
    const handleMute = () => setLive(false);
    const handleUnmute = () => setLive(true);
    track.addEventListener("mute", handleMute);
    track.addEventListener("unmute", handleUnmute);
    return () => {
      track.removeEventListener("mute", handleMute);
      track.removeEventListener("unmute", handleUnmute);
    };
  }, [track]);

  return live;
}

function VideoTile({ tile }: { tile: Tile }) {
  const live = useTrackLive(tile.stream);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-2">
      {live && tile.stream ? (
        <video
          autoPlay
          playsInline
          muted={tile.muted}
          ref={(el) => {
            if (el && el.srcObject !== tile.stream) el.srcObject = tile.stream;
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <ProfileAvatar code={tile.code} displayName={tile.displayName} size={56} />
      )}
      {/* Audio playback must not depend on the video-vs-avatar branch above:
          for a tile that should carry its own audio (tile.muted === false —
          only the 1:1 direct peer tile; local/group tiles are always
          muted: true), the <video> element only exists while `live` is true,
          so whenever the camera is off (the default/majority state for any
          call) there'd be no audio path at all. This separate, always-
          available sink covers that gap. It only renders while `!live`
          specifically to avoid playing the same audio twice: once `live` is
          true the <video> above is already mounted with muted={false} and
          playing this exact stream's audio track — 1:1 calls put both audio
          and video on one shared MediaStream (see videoCall.ts's
          addVideoTrackAndRenegotiate, which adds the camera track to the
          SAME local stream passed to pc.addTrack, so the remote side's
          ontrack event delivers both tracks on one stream object) — so
          mounting this unconditionally would double that track's audio. */}
      {!tile.muted && tile.stream && !live && (
        <audio
          autoPlay
          ref={(el) => {
            if (el && el.srcObject !== tile.stream) el.srcObject = tile.stream;
          }}
        />
      )}
      <span className="absolute bottom-1 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {tile.deafened ? (
          <HeadphoneOff size={11} className="shrink-0 text-red-400" aria-label="Deafened" />
        ) : tile.micMuted ? (
          <MicOff size={11} className="shrink-0 text-red-400" aria-label="Muted" />
        ) : null}
        {tile.displayName}
      </span>
    </div>
  );
}

export default function CallWindow() {
  const group = useGroupCall();
  const direct = useCall();
  const { showToast } = useToast();
  // One element, two behaviours: the ref lives here so both hooks address the
  // same node.
  const windowRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(windowRef);
  // Dragging a window that already fills the screen does nothing but fight the
  // Fullscreen API's own positioning.
  const { position, dragging, handleProps } = useDraggable(windowRef, POSITION_STORAGE_KEY, isFullscreen);
  const [togglingCamera, setTogglingCamera] = useState(false);
  const [togglingScreen, setTogglingScreen] = useState(false);
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const micMenuRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the device list on any click outside it, the way every other
  // popover in this app behaves.
  useEffect(() => {
    if (!micMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!micMenuRef.current?.contains(e.target as Node)) setMicMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [micMenuOpen]);

  const inGroupCall = Boolean(group.activeGroupCall);
  // Ringing states (outgoing/incoming, not yet connected) are intentionally
  // excluded — that UI is IncomingCallBanner's job (Task 5), unaffected by
  // this plan. CallWindow only takes over once a direct call is actually
  // connecting/connected, same scope as the old CallBar's "active" branch.
  const inDirectCall = Boolean(direct.activeCall) && direct.activeCall?.status !== "ringing-out" && direct.activeCall?.status !== "ringing-in";

  if (!inGroupCall && !inDirectCall) return null;

  const isGroup = inGroupCall;
  const title = isGroup ? group.activeGroupCall!.groupName : direct.activeCall!.peerDisplayName;
  const muted = isGroup ? group.muted : direct.muted;
  const cameraOn = isGroup ? group.cameraOn : direct.cameraOn;
  const screenSharing = isGroup ? group.screenSharing : direct.screenSharing;
  const microphones = isGroup ? group.microphones : direct.microphones;
  const micDeviceId = isGroup ? group.micDeviceId : direct.micDeviceId;
  const localStream = isGroup ? group.localStream : direct.localStream;

  const tiles: Tile[] = isGroup
    ? group.peers.map((p) => ({
        code: p.code,
        displayName: p.displayName,
        stream: group.remoteStreams[p.code] ?? null,
        muted: true,
        micMuted: p.muted,
        deafened: p.deafened,
      }))
    : direct.activeCall
      ? [
          {
            code: direct.activeCall.peerCode,
            displayName: direct.activeCall.peerDisplayName,
            stream: direct.remoteStream,
            muted: false,
            micMuted: direct.peerMuted,
          },
        ]
      : [];

  async function handleToggleCamera() {
    setTogglingCamera(true);
    try {
      if (isGroup) await group.toggleCamera();
      else await direct.toggleCamera();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't toggle camera.", "error");
    } finally {
      setTogglingCamera(false);
    }
  }

  async function handleToggleScreen() {
    setTogglingScreen(true);
    try {
      if (isGroup) await group.toggleScreenShare();
      else await direct.toggleScreenShare();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't share your screen.", "error");
    } finally {
      setTogglingScreen(false);
    }
  }

  // Device labels stay blank until the page has been granted mic permission,
  // so the list is only worth reading once a call is running — which is
  // exactly when this opens.
  async function handleOpenMicMenu() {
    const next = !micMenuOpen;
    setMicMenuOpen(next);
    if (!next) return;
    try {
      if (isGroup) await group.refreshMicrophones();
      else await direct.refreshMicrophones();
    } catch {
      // An unreadable device list is not worth interrupting a call over.
    }
  }

  async function handleSelectMic(deviceId: string) {
    setMicMenuOpen(false);
    try {
      if (isGroup) await group.selectMicrophone(deviceId);
      else await direct.selectMicrophone(deviceId);
      showToast("Microphone switched.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't switch microphone.", "error");
    }
  }

  function handleToggleMuted() {
    if (isGroup) group.toggleMuted();
    else direct.toggleMuted();
  }

  function handleLeave() {
    if (isGroup) group.leaveGroupCall();
    else direct.hangUp();
  }

  return (
    <AnimatePresence>
      <motion.div
        key="call-window"
        ref={windowRef}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        // Inline positioning is deliberately dropped in fullscreen: inline
        // styles outrank the UA rules that place a fullscreen element, so a
        // leftover left/top would push it off its own screen. `position` is
        // null for the first frame, before the starting corner can be measured.
        style={isFullscreen || !position ? undefined : { left: position.x, top: position.y }}
        className={`fixed z-50 flex flex-col gap-2 border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-xl ${
          isFullscreen
            ? "inset-0 rounded-none border-0"
            : "max-h-[calc(100vh-2rem)] w-[min(360px,calc(100%-2rem))] rounded-2xl border"
        } ${position || isFullscreen ? "" : "invisible"}`}
      >
        {/* The drag handle. Only the header, so a drag can't start on the tiles
            or swallow a press on the controls below. */}
        <div
          {...handleProps}
          className={`flex select-none items-center justify-between ${
            isFullscreen ? "" : dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="rounded-full p-1.5 text-muted hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <div className={`grid flex-1 gap-2 overflow-y-auto ${isFullscreen ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
          <VideoTile
            tile={{
              code: "me",
              displayName: "You",
              stream: localStream,
              muted: true,
              micMuted: muted,
              deafened: isGroup ? group.deafened : false,
            }}
          />
          {tiles.map((t) => (
            <VideoTile key={t.code} tile={t} />
          ))}
        </div>

        {/* A control dock rather than three bare icons: an active control now
            reads as lit rather than merely a slightly lighter circle, and
            leaving is set apart from the toggles so it can't be mis-hit. */}
        <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-surface-2/40 p-1.5">
          <div className="relative flex items-center" ref={micMenuRef}>
            <button
              onClick={handleToggleMuted}
              title={muted ? "Unmute" : "Mute"}
              className={`rounded-l-xl px-3 py-2.5 transition-colors duration-150 active:scale-95 ${
                muted
                  ? "bg-red-500/20 text-red-300"
                  : "bg-surface-2/80 text-foreground hover:bg-surface-2"
              }`}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              onClick={handleOpenMicMenu}
              title="Choose microphone"
              className="rounded-r-xl border-l border-border/60 bg-surface-2/80 px-1.5 py-2.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronDown size={13} />
            </button>

            {micMenuOpen && (
              <div className="panel absolute bottom-full left-0 z-10 mb-2 max-h-56 w-60 overflow-y-auto p-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Microphone
                </p>
                {microphones.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted">No microphones found.</p>
                ) : (
                  microphones.map((mic) => (
                    <button
                      key={mic.deviceId}
                      onClick={() => handleSelectMic(mic.deviceId)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <span className="w-3.5 shrink-0 text-accent-bright">
                        {mic.deviceId === micDeviceId && <Check size={13} />}
                      </span>
                      <span className="truncate">{mic.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleToggleCamera}
            disabled={togglingCamera}
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
            className={`rounded-xl px-3 py-2.5 transition-colors duration-150 active:scale-95 disabled:opacity-50 ${
              cameraOn
                ? "bg-accent/20 text-accent-bright shadow-[0_0_16px_-6px_rgba(var(--accent-rgb),0.9)]"
                : "bg-surface-2/80 text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          </button>

          <button
            onClick={handleToggleScreen}
            disabled={togglingScreen}
            title={screenSharing ? "Stop sharing your screen" : "Share your screen"}
            className={`rounded-xl px-3 py-2.5 transition-colors duration-150 active:scale-95 disabled:opacity-50 ${
              screenSharing
                ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_-6px_rgba(52,211,153,0.9)]"
                : "bg-surface-2/80 text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {screenSharing ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
          </button>

          <button
            onClick={handleLeave}
            title="Leave"
            className="ml-1 rounded-xl bg-red-500/20 px-3.5 py-2.5 text-red-300 transition-colors duration-150 hover:bg-red-500/30 active:scale-95"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
