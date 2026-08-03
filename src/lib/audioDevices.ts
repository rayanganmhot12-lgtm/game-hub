"use client";

// Microphone enumeration and acquisition, shared by GroupCallContext (server
// voice channels) and CallContext (1:1 friend calls). Like videoCall.ts this
// knows only about device plumbing, never about Firebase signaling.

export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

// Browsers hide device labels until the page has been granted microphone
// permission at least once, so before a call the list is a set of blank
// entries. Callers should enumerate again once a call is running, which is
// when the labels become readable.
export async function listMicrophones(): Promise<MicrophoneOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let devices: MediaDeviceInfo[];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone ${i + 1}`,
    }));
}

// `exact` rather than a plain deviceId: a plain one is only a preference, so
// a device that has been unplugged silently falls back to the default and the
// picker would show a selection that isn't what is actually live. Failing
// loudly lets the caller keep the old track and tell the user.
export async function acquireMicTrack(deviceId?: string): Promise<MediaStreamTrack> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    throw new Error("Couldn't switch to that microphone. It may be unplugged or in use by another app.");
  }
  const track = stream.getAudioTracks()[0];
  if (!track) {
    throw new Error("That microphone didn't produce an audio track.");
  }
  return track;
}
