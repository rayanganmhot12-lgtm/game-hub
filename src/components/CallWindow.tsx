"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { useGroupCall } from "@/context/GroupCallContext";
import { useCall } from "@/context/CallContext";
import { useToast } from "@/context/ToastContext";
import ProfileAvatar from "@/components/ProfileAvatar";

interface Tile {
  code: string;
  displayName: string;
  stream: MediaStream | null;
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
function useTrackLive(stream: MediaStream | null): boolean {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
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
  }, [stream]);

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
          muted={false}
          ref={(el) => {
            if (el && el.srcObject !== tile.stream) el.srcObject = tile.stream;
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <ProfileAvatar code={tile.code} displayName={tile.displayName} size={56} />
      )}
      <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {tile.displayName}
      </span>
    </div>
  );
}

export default function CallWindow() {
  const group = useGroupCall();
  const direct = useCall();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [togglingCamera, setTogglingCamera] = useState(false);

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
  const localStream = isGroup ? group.localStream : direct.localStream;

  const tiles: Tile[] = isGroup
    ? group.peers.map((p) => ({ code: p.code, displayName: p.displayName, stream: group.remoteStreams[p.code] ?? null }))
    : direct.activeCall
      ? [{ code: direct.activeCall.peerCode, displayName: direct.activeCall.peerDisplayName, stream: direct.remoteStream }]
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
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className={`fixed z-50 flex flex-col gap-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-xl transition-all ${
          expanded ? "inset-8" : "right-4 top-4 w-[min(360px,calc(100%-2rem))]"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <button onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"} className="rounded-full p-1.5 text-muted hover:text-foreground">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <div className={`grid flex-1 gap-2 overflow-y-auto ${expanded ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
          <VideoTile tile={{ code: "me", displayName: "You", stream: localStream }} />
          {tiles.map((t) => (
            <VideoTile key={t.code} tile={t} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleToggleMuted}
            title={muted ? "Unmute" : "Mute"}
            className={`rounded-full p-2.5 transition-transform duration-100 active:scale-90 ${muted ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            onClick={handleToggleCamera}
            disabled={togglingCamera}
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
            className={`rounded-full p-2.5 transition-transform duration-100 active:scale-90 disabled:opacity-50 ${cameraOn ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          </button>
          <button
            onClick={handleLeave}
            title="Leave"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
