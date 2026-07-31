"use client";

import { ref, set, remove, push, onValue, onChildAdded, off, onDisconnect, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { ICE_SERVERS } from "@/lib/webrtc";

export { ICE_SERVERS };

export interface GroupCallParticipant {
  displayName: string;
  joinedAt: number;
}

// A full-mesh voice call: every participant holds one RTCPeerConnection per
// other participant. Presence here ("who's actually in the voice call right
// now") is separate from the group's chat roster ("who's a member") — you
// can be a group member without being in the current call.
export function joinGroupCall(groupId: string, myCode: string, myDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  const myRef = ref(db, `groupCalls/${groupId}/participants/${myCode}`);
  onDisconnect(myRef).remove();
  return set(myRef, { displayName: myDisplayName, joinedAt: Date.now() });
}

export function leaveGroupCall(groupId: string, myCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupCalls/${groupId}/participants/${myCode}`));
}

export interface CallPresence {
  groupId: string;
  groupName: string;
  since: number;
}

// A top-level "which call (if any) is this person in right now" pointer —
// separate from groupCalls/{groupId}/participants, which is per-group and
// not something a friend's profile card can cheaply scan across every
// server just to answer "are they in a call?".
export function setCallPresence(myCode: string, groupId: string, groupName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  const myRef = ref(db, `callPresence/${myCode}`);
  onDisconnect(myRef).remove();
  return set(myRef, { groupId, groupName, since: Date.now() });
}

export function clearCallPresence(myCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `callPresence/${myCode}`));
}

export function listenForCallPresence(code: string, callback: (presence: CallPresence | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const presenceRef = ref(db, `callPresence/${code}`);
  const handler = (snapshot: DataSnapshot) => callback(snapshot.val());
  onValue(presenceRef, handler);
  return () => off(presenceRef, "value", handler);
}

export function listenForGroupCallParticipants(
  groupId: string,
  callback: (participants: Array<GroupCallParticipant & { code: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const partRef = ref(db, `groupCalls/${groupId}/participants`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupCallParticipant> | null;
    callback(val ? Object.entries(val).map(([code, data]) => ({ code, ...data })) : []);
  };
  onValue(partRef, handler);
  return () => off(partRef, "value", handler);
}

// Signaling is keyed per-pair (fromCode -> toCode) so N participants can
// negotiate independently without stepping on each other.
export function sendGroupCallOffer(groupId: string, fromCode: string, toCode: string, sdp: RTCSessionDescriptionInit) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  return set(ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/offer`), JSON.stringify(sdp));
}

export function listenForGroupCallOffer(
  groupId: string,
  fromCode: string,
  toCode: string,
  callback: (sdp: RTCSessionDescriptionInit) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const offerRef = ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/offer`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    if (val) callback(JSON.parse(val));
  };
  onValue(offerRef, handler);
  return () => off(offerRef, "value", handler);
}

export function sendGroupCallAnswer(groupId: string, fromCode: string, toCode: string, sdp: RTCSessionDescriptionInit) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Voice calls aren't set up yet."));
  return set(ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/answer`), JSON.stringify(sdp));
}

export function listenForGroupCallAnswer(
  groupId: string,
  fromCode: string,
  toCode: string,
  callback: (sdp: RTCSessionDescriptionInit) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const answerRef = ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/answer`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    if (val) callback(JSON.parse(val));
  };
  onValue(answerRef, handler);
  return () => off(answerRef, "value", handler);
}

export function sendGroupCallCandidate(
  groupId: string,
  fromCode: string,
  toCode: string,
  candidate: RTCIceCandidateInit
) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return push(ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/candidates`), JSON.stringify(candidate));
}

export function listenForGroupCallCandidates(
  groupId: string,
  fromCode: string,
  toCode: string,
  callback: (candidate: RTCIceCandidateInit) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const candRef = ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}/candidates`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val();
    if (val) callback(JSON.parse(val));
  };
  onChildAdded(candRef, handler);
  return () => off(candRef, "child_added", handler);
}

// Clears the signaling data for a pair once their connection is established
// (or torn down) — the participants list is the only thing that needs to
// stay live.
export function clearGroupCallSignals(groupId: string, fromCode: string, toCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupCalls/${groupId}/signals/${fromCode}/${toCode}`));
}
